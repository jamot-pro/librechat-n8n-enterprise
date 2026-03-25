import { useState, useRef } from 'react';
import { useToastContext } from '@librechat/client';
import DashboardHeader from '~/components/Dashboard/DashboardHeader';
import { useDashboardContext } from '~/layouts/DashboardLayout';
import CEOStrategicTools from '~/components/Profile/CEO/CEOStrategicTools';
import CEOReportView from '~/components/Profile/CEO/CEOReportView';

const n8nBaseUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://nadyaputriast-n8n.hf.space';
const openAiKey = import.meta.env.VITE_OPENAI_API_KEY;

interface AnalysisReport {
  title: string;
  summary: string;
  insights: string[];
  metrics: any;
  timestamp: string;
}

async function generateAIAnalysis(dataContext: any, reportTitle: string) {
  if (!openAiKey) {
    return {
      summary: 'OpenAI Key missing. Displaying raw data only.',
      insights: ['Please configure VITE_OPENAI_API_KEY in your .env file.'],
    };
  }
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a Senior Executive Assistant analyzing dashboard data for a CEO.
            Output MUST be valid JSON with this structure:
            { "summary": "A 2-3 sentence executive summary.", "insights": ["Point 1", "Point 2", "Point 3"] }`,
          },
          { role: 'user', content: `Analyze this ${reportTitle} data: ${JSON.stringify(dataContext)}` },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    const json = await response.json();
    return JSON.parse(json.choices[0].message.content);
  } catch {
    return { summary: 'AI Analysis unavailable.', insights: ['Check console for details.'] };
  }
}

export default function AnalyticsPage() {
  const { profile } = useDashboardContext();
  const { showToast } = useToastContext();
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [activeReport, setActiveReport] = useState<AnalysisReport | null>(null);
  const reportSectionRef = useRef<HTMLDivElement>(null);

  if (profile.profileType !== 'ceo') {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-text-secondary">Access restricted to CEO.</p>
      </div>
    );
  }

  const handleExecuteWorkflow = async (wf: any) => {
    const id = (wf.workflowId || '').toLowerCase();
    const name = (wf.workflowName || '').toLowerCase();

    if (id.includes('create') || name.includes('create') || id.includes('update') || id.includes('delete')) {
      showToast({ message: `"${wf.workflowName}" — use the relevant page instead.`, status: 'info' });
      return;
    }

    setExecutingId(wf.workflowId);
    try {
      const isFinancial = id.includes('financ') || name.includes('financ') || name.includes('revenue');
      const endpoint = isFinancial
        ? `${n8nBaseUrl}/webhook/librechat/financial-analytics`
        : `${n8nBaseUrl}/webhook/librechat/company-metrics`;
      const payload = isFinancial
        ? { period: 'last_30_days', _context: { profile: { profileType: 'ceo' } } }
        : { profileType: 'ceo' };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const n8nResult = await res.json();

      const rawData = Array.isArray(n8nResult) ? n8nResult[0] : n8nResult.data || n8nResult;
      const metricsData = rawData?.data || rawData?.json || rawData;
      if (!metricsData) throw new Error('No data received');

      showToast({ message: 'Generating AI Insights...', status: 'info' });
      const aiResult = await generateAIAnalysis(metricsData, wf.workflowName);

      setActiveReport({
        title: wf.workflowName,
        summary: aiResult.summary,
        insights: aiResult.insights,
        metrics: metricsData,
        timestamp: new Date().toLocaleString(),
      });
      showToast({ message: 'Report Ready', status: 'success' });

      setTimeout(() => {
        reportSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
    } catch (e: any) {
      showToast({ message: `Failed: ${e.message}`, status: 'error' });
    } finally {
      setExecutingId(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader title="Analytics & Reports" description="Run workflows and generate AI-powered insights" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <CEOStrategicTools
          profile={profile}
          executingId={executingId}
          activeReport={activeReport}
          handleExecuteWorkflow={handleExecuteWorkflow}
        />
        <div ref={reportSectionRef}>
          <CEOReportView activeReport={activeReport} reportSectionRef={reportSectionRef} />
        </div>
      </div>
    </div>
  );
}
