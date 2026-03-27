'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Ticket } from '@/types';
import { playSound } from '@/lib/utils';

const API_URL = typeof window !== 'undefined' 
  ? `http://${window.location.hostname}:4000` 
  : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface UseKDSSocketOptions {
  soundEnabled: boolean;
  redThreshold?: number;   // seconds before a ticket is considered "delayed"
}

export function useKDSSocket(soundEnabled: boolean, redThreshold = 600) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef       = useRef<Socket | null>(null);
  const soundEnabledRef = useRef(soundEnabled);
  const redThresholdRef = useRef(redThreshold);

  // Track which ticket IDs have already fired the "delayed" sound so we don't repeat
  const alertedDelayed  = useRef<Set<string>>(new Set());

  // Keep refs in sync with latest prop values
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { redThresholdRef.current = redThreshold; }, [redThreshold]);

  // ── Delayed-ticker monitor ────────────────────────────────────────────────
  // Runs every 15 s. Fires the alarm the FIRST time a ticket crosses the red
  // threshold so it never repeats for the same ticket.
  useEffect(() => {
    const check = () => {
      if (!soundEnabledRef.current) return;
      setTickets(current => {
        const now = Date.now();
        for (const t of current) {
          if (t.status === 'completed') continue;
          const elapsed = (now - t.created_at) / 1000;
          if (elapsed >= redThresholdRef.current && !alertedDelayed.current.has(t.id)) {
            alertedDelayed.current.add(t.id);
            playSound('delayed');
            break; // play once per check cycle even if multiple tickets are late
          }
        }
        return current; // no state mutation needed
      });
    };

    const id = setInterval(check, 15_000); // check every 15 seconds
    return () => clearInterval(id);
  }, []); // intentionally empty — refs keep values fresh

  const updateTicket = useCallback((updated: Ticket) => {
    setTickets(prev => {
      if (updated.status === 'completed') {
        // Clean up from delayed-alert tracking when a ticket is completed
        alertedDelayed.current.delete(updated.id);
        return prev.filter(t => t.id !== updated.id);
      }
      const exists = prev.find(t => t.id === updated.id);
      if (exists) return prev.map(t => t.id === updated.id ? updated : t);
      return [...prev, updated];
    });
  }, []);

  useEffect(() => {
    if (socketRef.current) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('kds-token') : null;
    const socket: Socket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('tickets:init', (data: Ticket[]) => {
      setTickets(data);
      // Pre-mark tickets that are already past the threshold on first load
      // so they don't trigger the alarm for old orders
      const now = Date.now();
      for (const t of data) {
        if ((now - t.created_at) / 1000 >= redThresholdRef.current) {
          alertedDelayed.current.add(t.id);
        }
      }
    });

    socket.on('accounts:init', (data: any[]) => {
      setAccounts(data);
    });

    socket.on('accounts:updated', (data: any[]) => {
      setAccounts(data);
    });

    socket.on('ticket:new', (ticket: Ticket) => {
      setTickets(prev => {
        if (prev.find(t => t.id === ticket.id)) return prev;
        return [ticket, ...prev];
      });
      if (soundEnabledRef.current) playSound('new_order');
    });

    socket.on('ticket:updated', (ticket: Ticket) => {
      updateTicket(ticket);
      if (soundEnabledRef.current && ticket.status === 'completed') {
        playSound('complete');
      }
    });

    socket.on('ticket:deleted', ({ id }: { id: string }) => {
      setTickets(prev => prev.filter(t => t.id !== id));
      alertedDelayed.current.delete(id);
    });

    return () => {
      socket.disconnect();
    };
  }, [updateTicket]);

  return { tickets, setTickets, accounts, setAccounts, connected, socket: socketRef.current };
}
