'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { PageHeader, LoadingSpinner, EmptyState } from '@/components/ui/stat-card';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import { invalidateAfterMutation } from '@/lib/invalidate-dashboard';

interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  department?: string;
  designation?: string;
  salary: number | string;
  isActive: boolean;
}

export default function HrPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get<Employee[]>('/hr'),
  });

  const form = useForm({
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      department: '',
      designation: '',
      salary: 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Employee>('/hr', body),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['employees']);
      toast.success('Employee added');
      setModalOpen(false);
      form.reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/hr/${id}`),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['employees']);
      toast.success('Employee removed');
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="HR"
        description="Human resources and employee management"
        action={
          <button className="btn-gold" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Add Employee
          </button>
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : !data?.length ? (
        <EmptyState message="No employees found." />
      ) : (
        <div className="luxury-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-luxury-border bg-luxury-cream">
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Department</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="px-4 py-3 text-left">Salary</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((employee) => (
                <tr key={employee.id} className="border-b border-luxury-border">
                  <td className="px-4 py-3 font-mono text-gold">{employee.employeeCode}</td>
                  <td className="px-4 py-3">{employee.firstName} {employee.lastName}</td>
                  <td className="px-4 py-3">{employee.department || '—'}</td>
                  <td className="px-4 py-3">{employee.phone}</td>
                  <td className="px-4 py-3">{formatCurrency(Number(employee.salary))}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="btn-danger !px-2 !py-1.5" onClick={() => setDeleteId(employee.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Employee">
        <form onSubmit={form.handleSubmit((values) => createMutation.mutate(values))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">First Name</label>
              <input {...form.register('firstName', { required: true })} className="luxury-input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Last Name</label>
              <input {...form.register('lastName', { required: true })} className="luxury-input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input {...form.register('phone', { required: true })} className="luxury-input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input {...form.register('email')} type="email" className="luxury-input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Department</label>
              <input {...form.register('department')} className="luxury-input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Designation</label>
              <input {...form.register('designation')} className="luxury-input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Salary</label>
              <input {...form.register('salary', { valueAsNumber: true })} type="number" className="luxury-input" />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-gold" disabled={createMutation.isPending}>Create</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Remove Employee"
        message="Are you sure you want to remove this employee?"
        confirmLabel="Remove"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
