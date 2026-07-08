'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { invalidateAfterMutation } from '@/lib/invalidate-dashboard';
import { PageHeader, LoadingSpinner, EmptyState } from '@/components/ui/stat-card';
import { Modal } from '@/components/ui/modal';
import { useForm } from 'react-hook-form';

interface Lead {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  status: string;
  source?: string;
  assignee?: { firstName: string; lastName: string };
}

interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  cnic?: string;
}

export default function CrmPage() {
  const queryClient = useQueryClient();
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);

  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => api.get<Lead[]>('/crm/leads'),
  });

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get<Customer[]>('/crm/customers'),
  });

  const leadForm = useForm({
    defaultValues: { name: '', phone: '', email: '', source: 'Walk-in', status: 'NEW' },
  });

  const customerForm = useForm({
    defaultValues: { name: '', phone: '', email: '', cnic: '', city: '' },
  });

  const createLeadMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Lead>('/crm/leads', body),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['leads']);
      toast.success('Lead created');
      setLeadModalOpen(false);
      leadForm.reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createCustomerMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Customer>('/crm/customers', body),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['customers']);
      toast.success('Customer created');
      setCustomerModalOpen(false);
      customerForm.reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="CRM" description="Leads and customer management" />

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Leads</h2>
            <button className="btn-gold !px-3 !py-1.5" onClick={() => setLeadModalOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Lead
            </button>
          </div>
          {leadsLoading ? (
            <LoadingSpinner />
          ) : !leads?.length ? (
            <EmptyState message="No leads found." />
          ) : (
            <div className="luxury-card divide-y divide-luxury-border">
              {leads.map((lead) => (
                <div key={lead.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{lead.name}</p>
                    <span className="rounded-full bg-gold-50 px-2 py-0.5 text-xs text-gold-700">{lead.status}</span>
                  </div>
                  <p className="text-sm text-luxury-slate mt-1">{lead.phone || lead.email}</p>
                  {lead.assignee && (
                    <p className="text-xs text-luxury-slate mt-1">
                      Assigned: {lead.assignee.firstName} {lead.assignee.lastName}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Customers</h2>
            <button className="btn-gold !px-3 !py-1.5" onClick={() => setCustomerModalOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Customer
            </button>
          </div>
          {customersLoading ? (
            <LoadingSpinner />
          ) : !customers?.length ? (
            <EmptyState message="No customers found." />
          ) : (
            <div className="luxury-card divide-y divide-luxury-border">
              {customers.map((c) => (
                <div key={c.id} className="p-4">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-luxury-slate">{c.phone || c.email}</p>
                  {c.cnic && <p className="text-xs text-luxury-slate mt-1">CNIC: {c.cnic}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal open={leadModalOpen} onClose={() => setLeadModalOpen(false)} title="Add Lead">
        <form
          onSubmit={leadForm.handleSubmit((form) => createLeadMutation.mutate(form))}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input {...leadForm.register('name', { required: true })} className="luxury-input" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input {...leadForm.register('phone', { required: true })} className="luxury-input" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input {...leadForm.register('email')} type="email" className="luxury-input" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Source</label>
            <input {...leadForm.register('source')} className="luxury-input" />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-outline" onClick={() => setLeadModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-gold" disabled={createLeadMutation.isPending}>Create</button>
          </div>
        </form>
      </Modal>

      <Modal open={customerModalOpen} onClose={() => setCustomerModalOpen(false)} title="Add Customer">
        <form
          onSubmit={customerForm.handleSubmit((form) => createCustomerMutation.mutate(form))}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input {...customerForm.register('name', { required: true })} className="luxury-input" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input {...customerForm.register('phone', { required: true })} className="luxury-input" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input {...customerForm.register('email')} type="email" className="luxury-input" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">CNIC</label>
            <input {...customerForm.register('cnic')} className="luxury-input" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">City</label>
            <input {...customerForm.register('city')} className="luxury-input" />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-outline" onClick={() => setCustomerModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-gold" disabled={createCustomerMutation.isPending}>Create</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
