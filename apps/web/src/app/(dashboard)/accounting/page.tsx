'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
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

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  balance: number | string;
  isActive?: boolean;
}

interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  reference?: string;
  lines: {
    accountId: string;
    debit: number | string;
    credit: number | string;
    account: { name: string; code?: string };
  }[];
}

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const;

const accountSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  type: z.enum(ACCOUNT_TYPES),
  isActive: z.boolean().optional(),
});

type AccountForm = z.infer<typeof accountSchema>;

const journalSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  reference: z.string().optional(),
  date: z.string().optional(),
  lines: z
    .array(
      z.object({
        accountId: z.string().min(1, 'Account is required'),
        debit: z.coerce.number().min(0),
        credit: z.coerce.number().min(0),
      })
    )
    .min(1, 'At least one line is required'),
});

type JournalForm = z.infer<typeof journalSchema>;

const typeColors: Record<string, string> = {
  ASSET: 'bg-blue-50 text-blue-700',
  LIABILITY: 'bg-orange-50 text-orange-700',
  EQUITY: 'bg-purple-50 text-purple-700',
  REVENUE: 'bg-green-50 text-green-700',
  EXPENSE: 'bg-red-50 text-red-700',
};

export default function AccountingPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'accounts' | 'journal'>('accounts');
  const accountsList = useListParams(10);
  const journalList = useListParams(10);

  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null);
  const [journalModalOpen, setJournalModalOpen] = useState(false);
  const [editingJournal, setEditingJournal] = useState<JournalEntry | null>(null);
  const [deleteJournalId, setDeleteJournalId] = useState<string | null>(null);

  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts', accountsList.queryString],
    queryFn: () => api.get<PaginatedResponse<Account>>(`/accounts?${accountsList.queryString}`),
  });

  const { data: journal, isLoading: journalLoading } = useQuery({
    queryKey: ['journal', journalList.queryString],
    queryFn: () => api.get<PaginatedResponse<JournalEntry>>(`/journal?${journalList.queryString}`),
  });

  const { data: allAccounts } = useQuery({
    queryKey: ['accounts-options'],
    queryFn: () => api.get<PaginatedResponse<Account>>('/accounts?limit=100'),
  });

  const accountForm = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: { code: '', name: '', type: 'ASSET', isActive: true },
  });

  const journalForm = useForm<JournalForm>({
    resolver: zodResolver(journalSchema),
    defaultValues: {
      description: '',
      reference: '',
      date: new Date().toISOString().split('T')[0],
      lines: [
        { accountId: '', debit: 0, credit: 0 },
        { accountId: '', debit: 0, credit: 0 },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: journalForm.control,
    name: 'lines',
  });

  const createAccountMutation = useMutation({
    mutationFn: (body: AccountForm) => api.post<Account>('/accounts', body),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['accounts', 'accounts-options']);
      toast.success('Account created');
      closeAccountModal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateAccountMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: AccountForm }) =>
      api.put<Account>(`/accounts/${id}`, body),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['accounts', 'accounts-options']);
      toast.success('Account updated');
      closeAccountModal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteAccountMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/accounts/${id}`),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['accounts', 'accounts-options']);
      toast.success('Account deleted');
      setDeleteAccountId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createJournalMutation = useMutation({
    mutationFn: (body: JournalForm) => api.post<JournalEntry>('/journal', body),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['journal', 'accounts']);
      toast.success('Journal entry created');
      closeJournalModal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateJournalMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: JournalForm }) =>
      api.put<JournalEntry>(`/journal/${id}`, body),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['journal', 'accounts']);
      toast.success('Journal entry updated');
      closeJournalModal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteJournalMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/journal/${id}`),
    onSuccess: () => {
      invalidateAfterMutation(queryClient, ['journal', 'accounts']);
      toast.success('Journal entry deleted');
      setDeleteJournalId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreateAccount = () => {
    setEditingAccount(null);
    accountForm.reset({ code: '', name: '', type: 'ASSET', isActive: true });
    setAccountModalOpen(true);
  };

  const openEditAccount = (account: Account) => {
    setEditingAccount(account);
    accountForm.reset({
      code: account.code,
      name: account.name,
      type: account.type as AccountForm['type'],
      isActive: account.isActive ?? true,
    });
    setAccountModalOpen(true);
  };

  const closeAccountModal = () => {
    setAccountModalOpen(false);
    setEditingAccount(null);
  };

  const onAccountSubmit = (form: AccountForm) => {
    if (editingAccount) updateAccountMutation.mutate({ id: editingAccount.id, body: form });
    else createAccountMutation.mutate(form);
  };

  const closeJournalModal = () => {
    setJournalModalOpen(false);
    setEditingJournal(null);
  };

  const openJournalModal = () => {
    setEditingJournal(null);
    journalForm.reset({
      description: '',
      reference: '',
      date: new Date().toISOString().split('T')[0],
      lines: [
        { accountId: '', debit: 0, credit: 0 },
        { accountId: '', debit: 0, credit: 0 },
      ],
    });
    setJournalModalOpen(true);
  };

  const openEditJournal = (entry: JournalEntry) => {
    setEditingJournal(entry);
    journalForm.reset({
      description: entry.description,
      reference: entry.reference || '',
      date: entry.date ? entry.date.split('T')[0] : new Date().toISOString().split('T')[0],
      lines: entry.lines.length
        ? entry.lines.map((line) => ({
            accountId: line.accountId,
            debit: Number(line.debit),
            credit: Number(line.credit),
          }))
        : [
            { accountId: '', debit: 0, credit: 0 },
            { accountId: '', debit: 0, credit: 0 },
          ],
    });
    setJournalModalOpen(true);
  };

  const onJournalSubmit = (form: JournalForm) => {
    if (editingJournal) updateJournalMutation.mutate({ id: editingJournal.id, body: form });
    else createJournalMutation.mutate(form);
  };

  return (
    <div>
      <PageHeader title="Accounting" description="Chart of accounts and journal entries" />

      <div className="mb-6 flex gap-2 border-b border-luxury-border">
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'accounts'
              ? 'border-gold text-gold'
              : 'border-transparent text-luxury-slate hover:text-luxury-charcoal'
          }`}
          onClick={() => setTab('accounts')}
        >
          Chart of Accounts
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'journal'
              ? 'border-gold text-gold'
              : 'border-transparent text-luxury-slate hover:text-luxury-charcoal'
          }`}
          onClick={() => setTab('journal')}
        >
          Journal Entries
        </button>
      </div>

      {tab === 'accounts' ? (
        <>
          <ListToolbar
            search={accountsList.search}
            onSearchChange={accountsList.setSearch}
            searchPlaceholder="Search by code or name..."
            filters={[
              {
                key: 'type',
                label: 'All types',
                value: accountsList.filters.type || '',
                onChange: (v) => accountsList.setFilter('type', v),
                options: ACCOUNT_TYPES.map((t) => ({ label: t, value: t })),
              },
            ]}
            action={
              <button className="btn-gold" onClick={openCreateAccount}>
                <Plus className="h-4 w-4" /> Add Account
              </button>
            }
          />

          {accountsLoading ? (
            <LoadingSpinner />
          ) : !accounts?.items.length ? (
            <EmptyState message="No accounts found." />
          ) : (
            <div className="luxury-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-luxury-border bg-luxury-cream">
                      <th className="px-4 py-3 text-left font-medium text-luxury-slate">Code</th>
                      <th className="px-4 py-3 text-left font-medium text-luxury-slate">Name</th>
                      <th className="px-4 py-3 text-left font-medium text-luxury-slate">Type</th>
                      <th className="px-4 py-3 text-right font-medium text-luxury-slate">Balance</th>
                      <th className="px-4 py-3 text-right font-medium text-luxury-slate">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.items.map((a) => (
                      <tr key={a.id} className="border-b border-luxury-border hover:bg-luxury-cream/50">
                        <td className="px-4 py-3 font-mono text-gold">{a.code}</td>
                        <td className="px-4 py-3">{a.name}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${typeColors[a.type] || 'bg-gray-50'}`}
                          >
                            {a.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(Number(a.balance))}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button className="btn-outline !px-2 !py-1.5" onClick={() => openEditAccount(a)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button className="btn-danger !px-2 !py-1.5" onClick={() => setDeleteAccountId(a.id)}>
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

          {accounts && (
            <PaginationBar
              page={accounts.page}
              totalPages={accounts.totalPages}
              total={accounts.total}
              limit={accounts.limit}
              onPageChange={accountsList.setPage}
            />
          )}
        </>
      ) : (
        <>
          <ListToolbar
            search={journalList.search}
            onSearchChange={journalList.setSearch}
            searchPlaceholder="Search description, reference, or entry #..."
            action={
              <button className="btn-gold" onClick={openJournalModal}>
                <Plus className="h-4 w-4" /> New Entry
              </button>
            }
          />

          {journalLoading ? (
            <LoadingSpinner />
          ) : !journal?.items.length ? (
            <EmptyState message="No journal entries found." />
          ) : (
            <div className="space-y-3">
              {journal.items.map((entry) => (
                <div key={entry.id} className="luxury-card p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <span className="font-mono text-sm text-gold">{entry.entryNumber}</span>
                      <p className="text-sm text-luxury-charcoal font-medium mt-1">{entry.description}</p>
                      {entry.reference && (
                        <p className="text-xs text-luxury-slate mt-0.5">Ref: {entry.reference}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-luxury-slate mr-2">{formatDate(entry.date)}</span>
                      <button className="btn-outline !px-2 !py-1.5" onClick={() => openEditJournal(entry)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button className="btn-danger !px-2 !py-1.5" onClick={() => setDeleteJournalId(entry.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-luxury-slate space-y-1 border-t border-luxury-border pt-2">
                    {entry.lines.map((line, i) => (
                      <div key={i} className="flex justify-between gap-4">
                        <span>
                          {line.account.code ? `${line.account.code} — ` : ''}
                          {line.account.name}
                        </span>
                        <span className="whitespace-nowrap font-medium">
                          {Number(line.debit) > 0 && `Dr ${formatCurrency(Number(line.debit))}`}
                          {Number(line.credit) > 0 && `Cr ${formatCurrency(Number(line.credit))}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {journal && (
            <PaginationBar
              page={journal.page}
              totalPages={journal.totalPages}
              total={journal.total}
              limit={journal.limit}
              onPageChange={journalList.setPage}
            />
          )}
        </>
      )}

      <Modal
        open={accountModalOpen}
        onClose={closeAccountModal}
        title={editingAccount ? 'Edit Account' : 'Add Account'}
      >
        <form onSubmit={accountForm.handleSubmit(onAccountSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Code</label>
            <input {...accountForm.register('code')} className="luxury-input" />
            {accountForm.formState.errors.code && (
              <p className="text-xs text-red-600 mt-1">{accountForm.formState.errors.code.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input {...accountForm.register('name')} className="luxury-input" />
            {accountForm.formState.errors.name && (
              <p className="text-xs text-red-600 mt-1">{accountForm.formState.errors.name.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select {...accountForm.register('type')} className="luxury-input">
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-outline" onClick={closeAccountModal}>Cancel</button>
            <button
              type="submit"
              className="btn-gold"
              disabled={createAccountMutation.isPending || updateAccountMutation.isPending}
            >
              {createAccountMutation.isPending || updateAccountMutation.isPending
                ? 'Saving...'
                : editingAccount
                  ? 'Update'
                  : 'Add'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={journalModalOpen}
        onClose={closeJournalModal}
        title={editingJournal ? 'Edit Journal Entry' : 'New Journal Entry'}
        className="max-w-2xl"
      >
        <form onSubmit={journalForm.handleSubmit(onJournalSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <input {...journalForm.register('description')} className="luxury-input" />
            {journalForm.formState.errors.description && (
              <p className="text-xs text-red-600 mt-1">{journalForm.formState.errors.description.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Reference</label>
              <input {...journalForm.register('reference')} className="luxury-input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <input {...journalForm.register('date')} type="date" className="luxury-input" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Lines</label>
              <button
                type="button"
                className="btn-outline !px-2 !py-1 text-xs"
                onClick={() => append({ accountId: '', debit: 0, credit: 0 })}
              >
                <Plus className="h-3 w-3" /> Add Line
              </button>
            </div>
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    {index === 0 && <label className="block text-xs text-luxury-slate mb-1">Account</label>}
                    <select {...journalForm.register(`lines.${index}.accountId`)} className="luxury-input">
                      <option value="">Select account</option>
                      {allAccounts?.items.map((a) => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    {index === 0 && <label className="block text-xs text-luxury-slate mb-1">Debit</label>}
                    <input {...journalForm.register(`lines.${index}.debit`)} type="number" step="0.01" className="luxury-input" />
                  </div>
                  <div className="col-span-3">
                    {index === 0 && <label className="block text-xs text-luxury-slate mb-1">Credit</label>}
                    <input {...journalForm.register(`lines.${index}.credit`)} type="number" step="0.01" className="luxury-input" />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {fields.length > 1 && (
                      <button type="button" className="btn-danger !px-2 !py-1.5" onClick={() => remove(index)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {journalForm.formState.errors.lines && (
              <p className="text-xs text-red-600 mt-1">
                {journalForm.formState.errors.lines.message || 'Check journal lines'}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-outline" onClick={closeJournalModal}>Cancel</button>
            <button
              type="submit"
              className="btn-gold"
              disabled={createJournalMutation.isPending || updateJournalMutation.isPending}
            >
              {createJournalMutation.isPending || updateJournalMutation.isPending
                ? 'Saving...'
                : editingJournal
                  ? 'Update'
                  : 'Post Entry'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteAccountId}
        onClose={() => setDeleteAccountId(null)}
        onConfirm={() => deleteAccountId && deleteAccountMutation.mutate(deleteAccountId)}
        title="Delete Account"
        message="Are you sure you want to delete this account?"
        confirmLabel="Delete"
        variant="danger"
        loading={deleteAccountMutation.isPending}
      />

      <ConfirmDialog
        open={!!deleteJournalId}
        onClose={() => setDeleteJournalId(null)}
        onConfirm={() => deleteJournalId && deleteJournalMutation.mutate(deleteJournalId)}
        title="Delete Journal Entry"
        message="Are you sure you want to delete this journal entry?"
        confirmLabel="Delete"
        variant="danger"
        loading={deleteJournalMutation.isPending}
      />
    </div>
  );
}
