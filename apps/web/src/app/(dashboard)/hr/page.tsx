'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, type PaginatedResponse } from '@/lib/api';
import { invalidateAfterMutation } from '@/lib/invalidate-dashboard';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PageHeader, LoadingSpinner, EmptyState } from '@/components/ui/stat-card';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import { ListToolbar, PaginationBar } from '@/components/ui/list-controls';
import { useListParams } from '@/hooks/use-list-params';

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
  joinDate?: string;
  isActive: boolean;
}

const employeeSchema = z.object({
  employeeCode: z.string().optional(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().min(1, 'Phone is required'),
  department: z.string().optional(),
  designation: z.string().optional(),
  salary: z.coerce.number().min(0),
  joinDate: z.string().optional(),
});

type EmployeeForm = z.infer<typeof employeeSchema>;

export default function HrPage() {
  const queryClient = useQueryClient();
  const list = useListParams(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['hr', list.queryString],
    queryFn: () => api.get<PaginatedResponse<Employee>>(`/hr?${list.queryString}`),
  });

  const departmentOptions = useMemo(() => {
    const current = list.filters.department;
    const fromItems = (data?.items || [])
      .map((e) => e.department)
      .filter((d): d is string => !!d && d.trim().length > 0);
    const set = new Set(fromItems);
    if (current) set.add(current);
    return Array.from(set).sort().map((d) => ({ label: d, value: d }));
  }, [data?.items, list.filters.department]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmployeeForm>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      employeeCode: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      department: '',
      designation: '',
      salary: 0,
      joinDate: new Date().toISOString().split('T')[0],
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: EmployeeForm) => api.post<Employee>('/hr', body),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['hr']);
      toast.success('Employee added');
      closeModal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: EmployeeForm }) =>
      api.put<Employee>(`/hr/${id}`, body),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['hr']);
      toast.success('Employee updated');
      closeModal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/hr/${id}`),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['hr']);
      toast.success('Employee removed');
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditing(null);
    reset({
      employeeCode: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      department: '',
      designation: '',
      salary: 0,
      joinDate: new Date().toISOString().split('T')[0],
    });
    setModalOpen(true);
  };

  const openEdit = (employee: Employee) => {
    setEditing(employee);
    reset({
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email || '',
      phone: employee.phone,
      department: employee.department || '',
      designation: employee.designation || '',
      salary: Number(employee.salary),
      joinDate: employee.joinDate ? employee.joinDate.split('T')[0] : '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const onSubmit = (form: EmployeeForm) => {
    if (editing) updateMutation.mutate({ id: editing.id, body: form });
    else createMutation.mutate(form);
  };

  return (
    <div>
      <PageHeader title="HR" description="Human resources and employee management" />

      <ListToolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search name, code, email, or phone..."
        filters={[
          {
            key: 'department',
            label: 'All departments',
            value: list.filters.department || '',
            onChange: (v) => list.setFilter('department', v),
            options: departmentOptions,
          },
        ]}
        action={
          <button className="btn-gold" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Employee
          </button>
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : !data?.items.length ? (
        <EmptyState message="No employees found." />
      ) : (
        <div className="luxury-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-luxury-border bg-luxury-cream">
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Code</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Department</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Designation</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Phone</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Salary</th>
                  <th className="px-4 py-3 text-left font-medium text-luxury-slate">Joined</th>
                  <th className="px-4 py-3 text-right font-medium text-luxury-slate">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((employee) => (
                  <tr key={employee.id} className="border-b border-luxury-border hover:bg-luxury-cream/50">
                    <td className="px-4 py-3 font-mono text-gold">{employee.employeeCode}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{employee.firstName} {employee.lastName}</p>
                      {employee.email && <p className="text-xs text-luxury-slate">{employee.email}</p>}
                    </td>
                    <td className="px-4 py-3 text-luxury-slate">{employee.department || '—'}</td>
                    <td className="px-4 py-3 text-luxury-slate">{employee.designation || '—'}</td>
                    <td className="px-4 py-3">{employee.phone}</td>
                    <td className="px-4 py-3">{formatCurrency(Number(employee.salary))}</td>
                    <td className="px-4 py-3 text-luxury-slate">
                      {employee.joinDate ? formatDate(employee.joinDate) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button className="btn-outline !px-2 !py-1.5" onClick={() => openEdit(employee)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button className="btn-danger !px-2 !py-1.5" onClick={() => setDeleteId(employee.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && (
        <PaginationBar
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          limit={data.limit}
          onPageChange={list.setPage}
        />
      )}

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Employee' : 'Add Employee'} className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Employee Code</label>
              <input {...register('employeeCode')} className="luxury-input" placeholder="Auto-generated if blank" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Join Date</label>
              <input {...register('joinDate')} type="date" className="luxury-input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">First Name</label>
              <input {...register('firstName')} className="luxury-input" />
              {errors.firstName && <p className="text-xs text-red-600 mt-1">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Last Name</label>
              <input {...register('lastName')} className="luxury-input" />
              {errors.lastName && <p className="text-xs text-red-600 mt-1">{errors.lastName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input {...register('phone')} className="luxury-input" />
              {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input {...register('email')} type="email" className="luxury-input" />
              {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Department</label>
              <input {...register('department')} className="luxury-input" list="hr-departments" />
              <datalist id="hr-departments">
                {departmentOptions.map((d) => (
                  <option key={d.value} value={d.value} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Designation</label>
              <input {...register('designation')} className="luxury-input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Salary</label>
              <input {...register('salary')} type="number" className="luxury-input" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-outline" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn-gold" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editing ? 'Update' : 'Add'}
            </button>
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
