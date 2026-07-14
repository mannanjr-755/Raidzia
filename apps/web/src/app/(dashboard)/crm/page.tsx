'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Search,
  Briefcase,
  CheckCircle2,
  Clock,
  AlertCircle,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Target,
  Filter,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/stat-card';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Project {
  id: string;
  projectName: string;
  clientName: string;
  projectStatus: 'Not Started' | 'In Progress' | 'Completed';
  totalProgress: number;
  completedWork: number;
  remainingWork: number;
  startDate: string;
  deadline: string;
  priority: 'High' | 'Medium' | 'Low';
  totalCost: number;
  amountPaid: number;
  remainingBalance: number;
  paymentStatus: 'Paid' | 'Partial' | 'Unpaid';
  lastPaymentDate: string | null;
}

const PROJECT_STATUSES = ['Not Started', 'In Progress', 'Completed'] as const;
const PRIORITIES = ['High', 'Medium', 'Low'] as const;
const PAYMENT_STATUSES = ['Paid', 'Partial', 'Unpaid'] as const;

const projectSchema = z
  .object({
    projectName: z.string().min(1, 'Project name is required'),
    clientName: z.string().min(1, 'Client name is required'),
    projectStatus: z.enum(PROJECT_STATUSES),
    totalProgress: z.coerce.number().min(0).max(100),
    startDate: z.string().min(1, 'Start date is required'),
    deadline: z.string().min(1, 'Deadline is required'),
    priority: z.enum(PRIORITIES),
    totalCost: z.coerce.number().min(0, 'Total cost is required'),
    amountPaid: z.coerce.number().min(0),
    paymentStatus: z.enum(PAYMENT_STATUSES),
    lastPaymentDate: z.string().optional(),
  })
  .refine((data) => new Date(data.deadline) >= new Date(data.startDate), {
    message: 'Deadline must be on or after start date',
    path: ['deadline'],
  });

type ProjectForm = z.infer<typeof projectSchema>;

const INITIAL_FORM: ProjectForm = {
  projectName: '',
  clientName: '',
  projectStatus: 'Not Started',
  totalProgress: 0,
  startDate: '',
  deadline: '',
  priority: 'Medium',
  totalCost: 0,
  amountPaid: 0,
  paymentStatus: 'Unpaid',
  lastPaymentDate: '',
};

function getStatusColor(status: string): string {
  switch (status) {
    case 'Completed':
    case 'Paid':
      return 'badge-green';
    case 'In Progress':
    case 'Partial':
      return 'badge-blue';
    case 'Not Started':
    case 'Unpaid':
      return 'badge-red';
    default:
      return 'badge-gray';
  }
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'High':
      return 'badge-red';
    case 'Medium':
      return 'badge-yellow';
    case 'Low':
      return 'badge-gray';
    default:
      return 'badge-gray';
  }
}

function getProgressFillColor(pct: number): string {
  if (pct >= 100) return 'progress-fill-green';
  if (pct >= 50) return 'progress-fill-blue';
  return 'progress-fill-gold';
}

function getPaymentProgressColor(pct: number): string {
  if (pct >= 100) return 'progress-fill-green';
  if (pct >= 50) return 'progress-fill-blue';
  return 'progress-fill-red';
}

function deriveRemainingWork(progress: number): number {
  return Math.max(0, 100 - progress);
}

function derivePaymentStatus(totalCost: number, amountPaid: number): 'Paid' | 'Partial' | 'Unpaid' {
  if (totalCost <= 0 || amountPaid <= 0) return 'Unpaid';
  if (amountPaid >= totalCost) return 'Paid';
  return 'Partial';
}

export default function CrmPage() {
  const [projects, setProjects] = useState<Project[]>([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [sortBy, setSortBy] = useState('deadline');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const form = useForm<ProjectForm>({
    resolver: zodResolver(projectSchema),
    defaultValues: INITIAL_FORM,
  });

  const watchedProgress = form.watch('totalProgress');
  const watchedTotalCost = form.watch('totalCost');
  const watchedAmountPaid = form.watch('amountPaid');

  const openCreate = () => {
    setEditingProject(null);
    form.reset(INITIAL_FORM);
    setModalOpen(true);
  };

  const openEdit = (project: Project) => {
    setEditingProject(project);
    form.reset({
      projectName: project.projectName,
      clientName: project.clientName,
      projectStatus: project.projectStatus,
      totalProgress: project.totalProgress,
      startDate: project.startDate,
      deadline: project.deadline,
      priority: project.priority,
      totalCost: project.totalCost,
      amountPaid: project.amountPaid,
      paymentStatus: project.paymentStatus,
      lastPaymentDate: project.lastPaymentDate ?? '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingProject(null);
  };

  const onSubmit = (data: ProjectForm) => {
    const remaining = deriveRemainingWork(data.totalProgress);
    const pStatus = derivePaymentStatus(data.totalCost, data.amountPaid);
    const remainingBal = Math.max(0, data.totalCost - data.amountPaid);

    if (editingProject) {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === editingProject.id
            ? {
                ...p,
                ...data,
                completedWork: data.totalProgress,
                remainingWork: remaining,
                remainingBalance: remainingBal,
                paymentStatus: pStatus,
                lastPaymentDate: data.lastPaymentDate || p.lastPaymentDate,
              }
            : p
        )
      );
      toast.success('Project updated successfully');
    } else {
      const newProject: Project = {
        id: Date.now().toString(),
        ...data,
        completedWork: data.totalProgress,
        remainingWork: remaining,
        remainingBalance: remainingBal,
        paymentStatus: pStatus,
        lastPaymentDate: data.lastPaymentDate || null,
      };
      setProjects((prev) => [newProject, ...prev]);
      toast.success('Project created successfully');
    }
    closeModal();
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    toast.success('Project deleted successfully');
    setDeleteTarget(null);
  };

  const filteredProjects = useMemo(() => {
    let result = [...projects];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.projectName.toLowerCase().includes(q) ||
          p.clientName.toLowerCase().includes(q)
      );
    }

    if (statusFilter) {
      result = result.filter((p) => p.projectStatus === statusFilter);
    }

    if (priorityFilter) {
      result = result.filter((p) => p.priority === priorityFilter);
    }

    if (paymentFilter) {
      result = result.filter((p) => p.paymentStatus === paymentFilter);
    }

    switch (sortBy) {
      case 'deadline':
        result.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
        break;
      case 'progress':
        result.sort((a, b) => b.totalProgress - a.totalProgress);
        break;
      case 'balance':
        result.sort((a, b) => b.remainingBalance - a.remainingBalance);
        break;
      case 'name':
        result.sort((a, b) => a.projectName.localeCompare(b.projectName));
        break;
    }

    return result;
  }, [projects, search, statusFilter, priorityFilter, paymentFilter, sortBy]);

  const summary = useMemo(() => {
    const total = projects.length;
    const completed = projects.filter((p) => p.projectStatus === 'Completed').length;
    const inProgress = projects.filter((p) => p.projectStatus === 'In Progress').length;
    const pending = projects.filter((p) => p.projectStatus === 'Not Started').length;
    const totalCost = projects.reduce((s, p) => s + p.totalCost, 0);
    const totalPaid = projects.reduce((s, p) => s + p.amountPaid, 0);
    const totalOutstanding = projects.reduce((s, p) => s + p.remainingBalance, 0);
    const avgCompletion =
      total > 0
        ? Math.round(projects.reduce((s, p) => s + p.totalProgress, 0) / total)
        : 0;

    return { total, completed, inProgress, pending, totalCost, totalPaid, totalOutstanding, avgCompletion };
  }, [projects]);

  return (
    <div>
      <PageHeader
        title="Project Management"
        description="Track and manage all projects, progress, and payments"
        action={
          <button className="btn-gold" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Project
          </button>
        }
      />

      {/* ── Summary Stats ── */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="stat-card summary-card-gold">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-luxury-slate">Total Projects</p>
              <p className="mt-2 text-2xl font-bold text-luxury-charcoal">{summary.total}</p>
            </div>
            <div className="rounded-lg bg-gold-50 p-2.5">
              <Briefcase className="h-5 w-5 text-gold" />
            </div>
          </div>
        </div>

        <div className="stat-card summary-card-green">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-luxury-slate">Completed</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">{summary.completed}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="stat-card summary-card-blue">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-luxury-slate">In Progress</p>
              <p className="mt-2 text-2xl font-bold text-blue-700">{summary.inProgress}</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-2.5">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="stat-card summary-card-red">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-luxury-slate">Pending</p>
              <p className="mt-2 text-2xl font-bold text-red-600">{summary.pending}</p>
            </div>
            <div className="rounded-lg bg-red-50 p-2.5">
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Financial Summary ── */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="luxury-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-gold-50 p-2.5">
              <DollarSign className="h-5 w-5 text-gold" />
            </div>
            <div>
              <p className="text-xs font-medium text-luxury-slate">Total Project Cost</p>
              <p className="text-lg font-bold text-luxury-charcoal">{formatCurrency(summary.totalCost)}</p>
            </div>
          </div>
        </div>

        <div className="luxury-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-50 p-2.5">
              <ArrowUpRight className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-luxury-slate">Amount Received</p>
              <p className="text-lg font-bold text-emerald-700">{formatCurrency(summary.totalPaid)}</p>
            </div>
          </div>
        </div>

        <div className="luxury-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-50 p-2.5">
              <ArrowDownRight className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-luxury-slate">Outstanding Balance</p>
              <p className="text-lg font-bold text-red-600">{formatCurrency(summary.totalOutstanding)}</p>
            </div>
          </div>
        </div>

        <div className="luxury-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2.5">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-luxury-slate">Avg. Completion</p>
              <p className="text-lg font-bold text-luxury-charcoal">{summary.avgCompletion}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Search, Filters & Sort ── */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-luxury-slate" />
            <input
              className="luxury-input pl-10"
              placeholder="Search projects by name or client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-luxury-slate" />
            <select
              className="sort-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>

            <select
              className="sort-select"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="">All Priority</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            <select
              className="sort-select"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
            >
              <option value="">All Payments</option>
              <option value="Paid">Paid</option>
              <option value="Partial">Partial</option>
              <option value="Unpaid">Unpaid</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-luxury-slate">Sort by:</span>
          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="deadline">Deadline</option>
            <option value="progress">Progress</option>
            <option value="balance">Remaining Balance</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>

      {/* ── Results Count ── */}
      <p className="mb-4 text-sm text-luxury-slate">
        Showing {filteredProjects.length} of {projects.length} projects
      </p>

      {/* ── Project Cards ── */}
      {filteredProjects.length === 0 ? (
        <div className="luxury-card flex flex-col items-center justify-center py-16 text-center">
          <Briefcase className="mb-3 h-10 w-10 text-luxury-slate/40" />
          <p className="text-luxury-slate">No Records Found</p>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {filteredProjects.map((project) => {
            const paymentPct =
              project.totalCost > 0
                ? Math.round((project.amountPaid / project.totalCost) * 100)
                : 0;

            return (
              <div key={project.id} className="project-card">
                {/* Card Header */}
                <div className="project-card-header">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-semibold text-luxury-charcoal">
                        {project.projectName}
                      </h3>
                      <p className="mt-0.5 text-sm text-luxury-slate">
                        Client: {project.clientName}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`badge ${getPriorityColor(project.priority)}`}>
                        {project.priority}
                      </span>
                      <span className={`badge ${getStatusColor(project.projectStatus)}`}>
                        {project.projectStatus}
                      </span>
                      <button
                        className="btn-outline !px-2 !py-1.5"
                        title="Edit project"
                        onClick={() => openEdit(project)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="btn-danger !px-2 !py-1.5"
                        title="Delete project"
                        onClick={() => setDeleteTarget(project)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="project-card-body">
                  {/* Project Progress */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-medium text-luxury-charcoal">Project Completion</span>
                      <span className="font-bold text-luxury-charcoal">{project.totalProgress}%</span>
                    </div>
                    <div className="progress-track">
                      <div
                        className={`progress-fill ${getProgressFillColor(project.totalProgress)}`}
                        style={{ width: `${project.totalProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Work Breakdown */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-emerald-50 p-3">
                      <p className="text-xs font-medium text-emerald-700">Completed Work</p>
                      <p className="mt-0.5 text-lg font-bold text-emerald-700">{project.completedWork}%</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-3">
                      <p className="text-xs font-medium text-amber-700">Remaining Work</p>
                      <p className="mt-0.5 text-lg font-bold text-amber-700">{project.remainingWork}%</p>
                    </div>
                  </div>

                  {/* Project Details */}
                  <div className="space-y-2 border-t border-luxury-border pt-3">
                    <div className="detail-row">
                      <span className="detail-label flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" /> Start Date
                      </span>
                      <span className="detail-value">{formatDate(project.startDate)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label flex items-center gap-1.5">
                        <Target className="h-3.5 w-3.5" /> Deadline
                      </span>
                      <span className="detail-value">{formatDate(project.deadline)}</span>
                    </div>
                  </div>

                  {/* Payment Progress */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-medium text-luxury-charcoal">Payment Progress</span>
                      <span className="font-bold text-luxury-charcoal">{paymentPct}%</span>
                    </div>
                    <div className="progress-track">
                      <div
                        className={`progress-fill ${getPaymentProgressColor(paymentPct)}`}
                        style={{ width: `${paymentPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Cost Details */}
                  <div className="space-y-2 border-t border-luxury-border pt-3">
                    <div className="detail-row">
                      <span className="detail-label">Total Project Cost</span>
                      <span className="detail-value">{formatCurrency(project.totalCost)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Amount Paid</span>
                      <span className="detail-value text-emerald-700">
                        {formatCurrency(project.amountPaid)}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Remaining Balance</span>
                      <span className="detail-value text-red-600">
                        {formatCurrency(project.remainingBalance)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="project-card-footer">
                  <div className="flex items-center justify-between">
                    <span className={`badge ${getStatusColor(project.paymentStatus)}`}>
                      {project.paymentStatus}
                    </span>
                    <span className="text-xs text-luxury-slate">
                      {project.lastPaymentDate
                        ? `Last payment: ${formatDate(project.lastPaymentDate)}`
                        : 'No payments yet'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingProject ? 'Edit Project' : 'Add New Project'}
        className="max-w-2xl"
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {/* Project Details Section */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-luxury-charcoal uppercase tracking-wide">
              Project Details
            </h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Project Name *</label>
                <input {...form.register('projectName')} className="luxury-input" />
                {form.formState.errors.projectName && (
                  <p className="mt-1 text-xs text-red-600">{form.formState.errors.projectName.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Client Name *</label>
                <input {...form.register('clientName')} className="luxury-input" />
                {form.formState.errors.clientName && (
                  <p className="mt-1 text-xs text-red-600">{form.formState.errors.clientName.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Project Status</label>
                <select {...form.register('projectStatus')} className="luxury-input">
                  {PROJECT_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Priority</label>
                <select {...form.register('priority')} className="luxury-input">
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Start Date *</label>
                <input {...form.register('startDate')} type="date" className="luxury-input" />
                {form.formState.errors.startDate && (
                  <p className="mt-1 text-xs text-red-600">{form.formState.errors.startDate.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Deadline *</label>
                <input {...form.register('deadline')} type="date" className="luxury-input" />
                {form.formState.errors.deadline && (
                  <p className="mt-1 text-xs text-red-600">{form.formState.errors.deadline.message}</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">
                  Total Progress: <span className="font-bold text-gold">{watchedProgress}%</span>
                </label>
                <input
                  {...form.register('totalProgress')}
                  type="range"
                  min={0}
                  max={100}
                  className="w-full accent-gold"
                />
                <div className="progress-track mt-2">
                  <div
                    className={`progress-fill ${getProgressFillColor(watchedProgress)}`}
                    style={{ width: `${watchedProgress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Cost Details Section */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-luxury-charcoal uppercase tracking-wide">
              Cost Details
            </h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Total Project Cost (PKR) *</label>
                <input
                  {...form.register('totalCost')}
                  type="number"
                  className="luxury-input"
                  placeholder="0"
                />
                {form.formState.errors.totalCost && (
                  <p className="mt-1 text-xs text-red-600">{form.formState.errors.totalCost.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Amount Paid (PKR)</label>
                <input
                  {...form.register('amountPaid')}
                  type="number"
                  className="luxury-input"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Payment Status</label>
                <select {...form.register('paymentStatus')} className="luxury-input">
                  {PAYMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Last Payment Date</label>
                <input {...form.register('lastPaymentDate')} type="date" className="luxury-input" />
              </div>
            </div>

            {/* Live Preview */}
            {(watchedTotalCost > 0 || watchedAmountPaid > 0) && (
              <div className="mt-4 rounded-lg border border-luxury-border bg-luxury-cream p-3">
                <p className="mb-2 text-xs font-semibold text-luxury-charcoal uppercase tracking-wide">
                  Payment Preview
                </p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-luxury-slate">Remaining Balance:</span>
                    <span className="font-medium text-red-600">
                      {formatCurrency(Math.max(0, watchedTotalCost - watchedAmountPaid))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-luxury-slate">Payment Progress:</span>
                    <span className="font-medium">
                      {watchedTotalCost > 0
                        ? Math.round((watchedAmountPaid / watchedTotalCost) * 100)
                        : 0}%
                    </span>
                  </div>
                </div>
                <div className="progress-track mt-2">
                  <div
                    className={`progress-fill ${getPaymentProgressColor(
                      watchedTotalCost > 0
                        ? Math.round((watchedAmountPaid / watchedTotalCost) * 100)
                        : 0
                    )}`}
                    style={{
                      width: `${
                        watchedTotalCost > 0
                          ? Math.min(100, Math.round((watchedAmountPaid / watchedTotalCost) * 100))
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-luxury-border pt-4">
            <button type="button" className="btn-outline" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" className="btn-gold">
              {editingProject ? 'Update Project' : 'Create Project'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Confirmation ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Project"
        message={`Are you sure you want to delete "${deleteTarget?.projectName}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
