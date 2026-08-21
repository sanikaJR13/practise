import { useEffect, useState, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ShieldCheck, MapPin, FileText, BrainCircuit, SearchCheck, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, SelectInput, TextInput } from '@/components/ui/Field';
import { apiClient } from '@/lib/api/api-client';
import { normalizeLocationOption } from '@/lib/api/adapters';
import { cn } from '@/lib/utils/cn';

export function PropertySearchPage() {
  const navigate = useNavigate();

  // Form State
  const [form, setForm] = useState({
    districtValue: '',
    talukaValue: '',
    villageValue: '',
    propertyNumber: '',
    yearFrom: '2020',
    yearTo: String(new Date().getFullYear())
  });

  const [formErrors, setFormErrors] = useState({});

  // 1. Fetch Districts
  const districtsQuery = useQuery({
    queryKey: ['locations', 'districts'],
    queryFn: () => apiClient.get('locations/districts/'),
    select: (data) => (data || []).map(normalizeLocationOption)
  });

  // 2. Fetch Talukas (depends on District)
  const talukasQuery = useQuery({
    queryKey: ['locations', 'talukas', form.districtValue],
    queryFn: () => apiClient.get('locations/talukas/', { params: { district_code: form.districtValue } }),
    enabled: Boolean(form.districtValue),
    select: (data) => (data || []).map(normalizeLocationOption)
  });

  // 3. Fetch Villages (depends on Taluka)
  const villagesQuery = useQuery({
    queryKey: ['locations', 'villages', form.districtValue, form.talukaValue],
    queryFn: () => apiClient.get('locations/villages/', { 
      params: { 
        district_code: form.districtValue,
        taluka_code: form.talukaValue
      } 
    }),
    enabled: Boolean(form.districtValue) && Boolean(form.talukaValue),
    select: (data) => (data || []).map(normalizeLocationOption)
  });

  // Clear sub-dropdowns on parent change
  useEffect(() => {
    setForm((prev) => ({ ...prev, talukaValue: '', villageValue: '' }));
  }, [form.districtValue]);

  useEffect(() => {
    setForm((prev) => ({ ...prev, villageValue: '' }));
  }, [form.talukaValue]);

  // Start Workflow Mutation
  const startWorkflowMutation = useMutation({
    mutationFn: async (payload) => {
      // Step A: Ensure property is created
      const districtLabel = districtsQuery.data?.find((d) => d.value === form.districtValue)?.label || '';
      const talukaLabel = talukasQuery.data?.find((t) => t.value === form.talukaValue)?.label || '';
      const villageLabel = villagesQuery.data?.find((v) => v.value === form.villageValue)?.label || '';

      const propertyPayload = {
        label: `${form.propertyNumber} / ${villageLabel}`,
        district_name: districtLabel,
        taluka_name: talukaLabel,
        village_name: villageLabel,
        survey_number: form.propertyNumber,
        subdivision_number: '',
        property_number: form.propertyNumber,
        metadata: {
          workflow_type: 'igr_only',
          selection: {
            district_code: form.districtValue,
            taluka_code: form.talukaValue,
            village_code: form.villageValue
          }
        }
      };

      const property = await apiClient.post('properties/', propertyPayload);

      // Step B: Start overall workflow
      const startPayload = {
        property_id: property.id,
        workflow_type: 'igr_only',
        sources: {
          igr: {
            property_number: form.propertyNumber
          }
        },
        year_from: Number(form.yearFrom),
        year_to: Number(form.yearTo)
      };

      return apiClient.post('workflows/start_workflow/', startPayload);
    },
    onSuccess: (data) => {
      navigate(`/workflows/${data.id}`);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = {};
    if (!form.districtValue) errors.districtValue = 'District is required';
    if (!form.talukaValue) errors.talukaValue = 'Taluka is required';
    if (!form.villageValue) errors.villageValue = 'Village is required';
    if (!form.propertyNumber?.trim()) errors.propertyNumber = 'Property number is required';
    if (!form.yearFrom) errors.yearFrom = 'Year from is required';
    if (!form.yearTo) errors.yearTo = 'Year to is required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    startWorkflowMutation.mutate();
  };

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-7 px-4 py-8">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <p className="section-eyebrow">Maharashtra IGR Service</p>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-primary sm:text-5xl">
            Maharashtra IGR History Scraper
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-on-surface-variant sm:text-base">
            Select a target district, taluka, and village. Provide a property number to scan, retrieve, and visualize the complete registry transaction sequence across years.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Badge tone="info">
            <ShieldCheck className="h-3.5 w-3.5" />
            OCR Captcha Auto-solve
          </Badge>
          <Badge tone="neutral">Self-contained SQLite Database</Badge>
        </div>
      </section>

      {/* How it works Horizontal Stepper */}
      <section className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 bg-white p-6 rounded-[1.75rem] border border-outline-variant/15 shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
          {[
            { label: 'Enter Property Details', icon: MapPin, color: 'bg-primary-fixed/25 text-primary border-primary-fixed' },
            { label: 'Scrape Registry Year-by-Year', icon: FileText, color: 'bg-tertiary-fixed/20 text-on-tertiary-fixed-variant border-tertiary-fixed/30' },
            { label: 'Process CAPTCHAs via OCR', icon: BrainCircuit, color: 'bg-secondary-container/70 text-on-secondary-container border-secondary-container' },
            { label: 'Generate Interactive Timeline', icon: SearchCheck, color: 'bg-surface-container text-primary border-outline-variant/30' }
          ].map((step, idx) => {
            const Icon = step.icon;
            return (
              <div key={idx} className="flex flex-col items-center text-center p-3 relative group">
                <div className={cn("flex h-14 w-14 items-center justify-center rounded-full border shadow-sm", step.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="mt-3 text-sm font-semibold text-primary max-w-[170px]">
                  {step.label}
                </span>
                {idx < 3 && (
                  <div className="hidden md:block absolute top-10 -right-4 w-8 h-[2px] bg-outline-variant/20" />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Main Search Card */}
      <Card className="p-8 rounded-[2rem] border-outline-variant/20 bg-white">
        <form onSubmit={handleSubmit} className="space-y-6">
          <h2 className="font-headline text-2xl font-bold text-primary border-b pb-4 border-outline-variant/10">
            Property Specifications
          </h2>

          <div className="grid gap-6 md:grid-cols-3">
            <Field error={formErrors.districtValue} label="District" requirement="Select Maharashtra District">
              <SelectInput
                id="districtSelect"
                value={form.districtValue}
                onChange={(e) => setForm((prev) => ({ ...prev, districtValue: e.target.value }))}
                disabled={districtsQuery.isLoading}
              >
                <option value="">{districtsQuery.isLoading ? 'Fetching districts...' : '-- Select District --'}</option>
                {districtsQuery.data?.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </SelectInput>
            </Field>

            <Field error={formErrors.talukaValue} label="Taluka" requirement="Select Taluka">
              <SelectInput
                id="talukaSelect"
                value={form.talukaValue}
                onChange={(e) => setForm((prev) => ({ ...prev, talukaValue: e.target.value }))}
                disabled={!form.districtValue || talukasQuery.isLoading}
              >
                <option value="">
                  {!form.districtValue 
                    ? 'Choose district first' 
                    : talukasQuery.isLoading 
                      ? 'Fetching talukas...' 
                      : '-- Select Taluka --'}
                </option>
                {talukasQuery.data?.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </SelectInput>
            </Field>

            <Field error={formErrors.villageValue} label="Village" requirement="Select Village">
              <SelectInput
                id="villageSelect"
                value={form.villageValue}
                onChange={(e) => setForm((prev) => ({ ...prev, villageValue: e.target.value }))}
                disabled={!form.talukaValue || villagesQuery.isLoading}
              >
                <option value="">
                  {!form.talukaValue 
                    ? 'Choose taluka first' 
                    : villagesQuery.isLoading 
                      ? 'Fetching villages...' 
                      : '-- Select Village --'}
                </option>
                {villagesQuery.data?.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </SelectInput>
            </Field>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Field error={formErrors.propertyNumber} label="Property Number" requirement="E.g. Survey, CTS, or Gat number">
              <TextInput
                id="propertyNumberInput"
                placeholder="Enter property number..."
                value={form.propertyNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, propertyNumber: e.target.value }))}
              />
            </Field>

            <Field error={formErrors.yearFrom} label="From Year" requirement="Starting search range">
              <TextInput
                id="yearFromInput"
                type="number"
                value={form.yearFrom}
                onChange={(e) => setForm((prev) => ({ ...prev, yearFrom: e.target.value }))}
              />
            </Field>

            <Field error={formErrors.yearTo} label="To Year" requirement="Ending search range">
              <TextInput
                id="yearToInput"
                type="number"
                value={form.yearTo}
                onChange={(e) => setForm((prev) => ({ ...prev, yearTo: e.target.value }))}
              />
            </Field>
          </div>

          <div className="flex justify-end pt-4 border-t border-outline-variant/10">
            <Button
              type="submit"
              tone="primary"
              className="px-8 py-3 rounded-xl flex items-center gap-2"
              disabled={startWorkflowMutation.isPending}
            >
              {startWorkflowMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Initializing Scraper...
                </>
              ) : (
                'Start IGR Scraper'
              )}
            </Button>
          </div>

          {startWorkflowMutation.isError && (
            <div className="p-4 bg-error-container/30 border border-error-container/50 rounded-xl text-error text-sm font-medium">
              Error launching scraper: {startWorkflowMutation.error.message || 'Check local backend connections.'}
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}

// Simple Badge fallback component
function Badge({ children, tone }) {
  const tones = {
    info: 'bg-secondary-container text-on-secondary-container border-secondary-container',
    neutral: 'bg-surface-container-high text-primary border-outline-variant/30'
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border", tones[tone] || tones.neutral)}>
      {children}
    </span>
  );
}
