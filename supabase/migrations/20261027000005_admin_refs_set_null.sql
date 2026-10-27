-- Removing an admin account keeps the records they handled; only the link to them is cleared.
alter table public.reports drop constraint reports_resolved_by_fkey,
  add constraint reports_resolved_by_fkey foreign key (resolved_by) references public.profiles on delete set null;
alter table public.payout_requests drop constraint payout_requests_decided_by_fkey,
  add constraint payout_requests_decided_by_fkey foreign key (decided_by) references public.profiles on delete set null;
