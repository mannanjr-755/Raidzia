'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api, type PaginatedResponse } from '@/lib/api';
import { PageHeader, LoadingSpinner, EmptyState } from '@/components/ui/stat-card';
import { ListToolbar } from '@/components/ui/list-controls';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
  code: string;
  status?: string;
  location?: string;
}

interface Unit {
  id: string;
  unitNumber: string;
  status: string;
  area?: number | string;
  areaSqFt?: number | string;
  type?: string;
}

interface Floor {
  id: string;
  number: number;
  name?: string;
  units: Unit[];
}

interface Building {
  id: string;
  name: string;
  floors: Floor[];
}

const UNIT_STATUSES = ['AVAILABLE', 'RESERVED', 'SOLD', 'UNDER_CONSTRUCTION'] as const;

const unitStatusColors: Record<string, { bg: string; border: string; label: string }> = {
  SOLD: { bg: 'bg-green-500', border: 'border-green-600', label: 'Sold' },
  RESERVED: { bg: 'bg-blue-500', border: 'border-blue-600', label: 'Reserved' },
  BOOKED: { bg: 'bg-blue-400', border: 'border-blue-500', label: 'Reserved' },
  AVAILABLE: { bg: 'bg-white', border: 'border-gray-300', label: 'Available' },
  UNDER_CONSTRUCTION: { bg: 'bg-orange-500', border: 'border-orange-600', label: 'Under Construction' },
  TRANSFERRED: { bg: 'bg-purple-500', border: 'border-purple-600', label: 'Transferred' },
};

function UnitCell({ unit }: { unit: Unit }) {
  const style = unitStatusColors[unit.status] || unitStatusColors.AVAILABLE;
  const isLight = unit.status === 'AVAILABLE';
  const area = unit.area ?? unit.areaSqFt;

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center rounded border-2 p-2 min-h-[48px] transition-all hover:scale-105 hover:shadow-md cursor-pointer',
        style.bg,
        style.border,
        isLight && 'text-luxury-charcoal'
      )}
      title={`${unit.unitNumber} - ${style.label}`}
    >
      <span className={cn('text-xs font-bold', !isLight && 'text-white')}>{unit.unitNumber}</span>
      {area && (
        <span className={cn('text-[10px]', !isLight ? 'text-white/80' : 'text-luxury-slate')}>
          {Number(area)} sqft
        </span>
      )}
    </div>
  );
}

function BuildingViewer({
  building,
  unitStatusFilter,
}: {
  building: Building;
  unitStatusFilter: string;
}) {
  const sortedFloors = [...building.floors]
    .sort((a, b) => b.number - a.number)
    .map((floor) => ({
      ...floor,
      units: unitStatusFilter
        ? floor.units.filter((u) => {
            if (unitStatusFilter === 'RESERVED') {
              return u.status === 'RESERVED' || u.status === 'BOOKED';
            }
            return u.status === unitStatusFilter;
          })
        : floor.units,
    }));

  return (
    <div className="luxury-card p-6">
      <h3 className="text-lg font-semibold text-luxury-charcoal mb-4 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-gold" />
        {building.name}
      </h3>
      <div className="space-y-2">
        {sortedFloors.map((floor) => (
          <div key={floor.id} className="flex items-center gap-3">
            <div className="w-16 shrink-0 text-right">
              <span className="text-xs font-medium text-luxury-slate">
                {floor.name || `Floor ${floor.number}`}
              </span>
            </div>
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 p-3 rounded-lg bg-luxury-cream border border-luxury-border">
              {floor.units.length === 0 ? (
                <span className="text-xs text-luxury-slate col-span-full text-center py-2">
                  {unitStatusFilter ? 'No matching units' : 'No units'}
                </span>
              ) : (
                floor.units.map((unit) => <UnitCell key={unit.id} unit={unit} />)
              )}
            </div>
          </div>
        ))}
      </div>
      {sortedFloors.length === 0 && (
        <p className="text-sm text-luxury-slate text-center py-8">No floors configured</p>
      )}
    </div>
  );
}

export default function DigitalTwinPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [unitStatusFilter, setUnitStatusFilter] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => api.get<PaginatedResponse<Project>>('/projects?limit=100'),
  });

  const filteredProjects = useMemo(() => {
    const items = projects?.items || [];
    const q = search.trim().toLowerCase();
    return items.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.location || '').toLowerCase().includes(q);
      const matchesStatus = !statusFilter || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects?.items, search, statusFilter]);

  const { data: buildings, isLoading: buildingsLoading } = useQuery({
    queryKey: ['digital-twin', selectedProjectId],
    queryFn: () => api.get<Building[]>(`/properties/digital-twin/${selectedProjectId}`),
    enabled: !!selectedProjectId,
  });

  const selectedProject = filteredProjects.find((p) => p.id === selectedProjectId)
    || projects?.items.find((p) => p.id === selectedProjectId);

  return (
    <div>
      <PageHeader
        title="Digital Twin"
        description="Interactive building visualization with unit status"
      />

      <div className="mb-4 luxury-card p-4 text-sm text-luxury-slate">
        Digital Twin is a read-only viewer. To add or edit buildings, floors, and units, use the{' '}
        <Link href="/properties" className="text-gold hover:underline font-medium">
          Properties
        </Link>{' '}
        module.
      </div>

      <ListToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setSelectedProjectId('');
        }}
        searchPlaceholder="Search projects by name, code, or location..."
        filters={[
          {
            key: 'status',
            label: 'All project statuses',
            value: statusFilter,
            onChange: (v) => {
              setStatusFilter(v);
              setSelectedProjectId('');
            },
            options: ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'].map((s) => ({
              label: s,
              value: s,
            })),
          },
          {
            key: 'unitStatus',
            label: 'All unit statuses',
            value: unitStatusFilter,
            onChange: setUnitStatusFilter,
            options: UNIT_STATUSES.map((s) => ({ label: s, value: s })),
          },
        ]}
      />

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="min-w-[280px] flex-1 max-w-md">
          <label className="block text-sm font-medium mb-1.5">Select Project</label>
          <select
            className="luxury-input"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            disabled={projectsLoading}
          >
            <option value="">Choose a project...</option>
            {filteredProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
          {!projectsLoading && filteredProjects.length === 0 && (
            <p className="text-xs text-luxury-slate mt-1">No projects match your search/filters.</p>
          )}
        </div>

        <div className="flex flex-wrap gap-3 pb-1">
          {Object.entries(unitStatusColors)
            .filter(([k]) => k !== 'BOOKED' && k !== 'TRANSFERRED')
            .map(([status, style]) => (
              <div key={status} className="flex items-center gap-2 text-xs">
                <div className={cn('h-4 w-4 rounded border-2', style.bg, style.border)} />
                <span className="text-luxury-slate">{style.label}</span>
              </div>
            ))}
        </div>
      </div>

      {selectedProject && (
        <p className="mb-4 text-sm text-luxury-slate">
          Viewing <span className="font-medium text-luxury-charcoal">{selectedProject.name}</span>
          {selectedProject.status ? ` · ${selectedProject.status}` : ''}
          {selectedProject.location ? ` · ${selectedProject.location}` : ''}
        </p>
      )}

      {!selectedProjectId ? (
        <EmptyState message="Select a project to view the digital twin." />
      ) : buildingsLoading ? (
        <LoadingSpinner />
      ) : !buildings?.length ? (
        <EmptyState message="No buildings found for this project." />
      ) : (
        <div className="space-y-6">
          {buildings.map((building) => (
            <BuildingViewer
              key={building.id}
              building={building}
              unitStatusFilter={unitStatusFilter}
            />
          ))}
        </div>
      )}
    </div>
  );
}
