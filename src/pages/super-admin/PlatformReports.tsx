import { useState } from 'react';
import {
  FileDown,
  Building2,
  GitFork,
  Users,
  ShieldAlert,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { superAdminService } from '@/services/api/superAdmin.service';
import { toast } from 'react-toastify';

export default function PlatformReports() {
  const [downloadingType, setDownloadingType] = useState<string | null>(null);

  const reports = [
    {
      type: 'organizations' as const,
      title: 'Tenant Organizations Report',
      description: 'Complete export of all registered tenants, legal entities, contact details, branch counts, and subscription statuses.',
      icon: Building2,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10 border-amber-500/20',
      estimatedSize: '~50 KB per 1,000 tenants',
    },
    {
      type: 'hostels' as const,
      title: 'Global Hostel Properties Report',
      description: 'Cross-tenant hostel properties, branch codes, bed capacity, occupancy levels, wardens, and amenities.',
      icon: GitFork,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10 border-blue-500/20',
      estimatedSize: '~80 KB per 1,000 hostels',
    },
    {
      type: 'users' as const,
      title: 'Global Users & RBAC Roles Report',
      description: 'All system users across tenants, assigned roles, organization bindings, active statuses, and account lockouts.',
      icon: Users,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      estimatedSize: '~150 KB per 5,000 users',
    },
    {
      type: 'audit-logs' as const,
      title: 'Audit & Compliance Trail Report',
      description: 'Time-stamped audit records of administrative mutations, privilege changes, tenant creations, and security events.',
      icon: ShieldAlert,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10 border-purple-500/20',
      estimatedSize: '~2 MB per 50,000 log items',
    },
  ];

  const handleDownload = async (type: 'organizations' | 'hostels' | 'users' | 'audit-logs', title: string) => {
    try {
      setDownloadingType(type);
      toast.info(`Generating streaming export for ${title}...`);
      const blob = await superAdminService.downloadReport(type);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `q2_${type}_report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`${title} downloaded successfully!`);
    } catch (error) {
      console.error(`Failed to export ${type} report:`, error);
      toast.error(`Failed to generate ${title}.`);
    } finally {
      setDownloadingType(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Platform Reports & Exports</h1>
        <p className="text-sm text-muted-foreground">
          Stream high-volume tabular platform data directly into CSV files using memory-safe backend cursors.
        </p>
      </div>

      {/* Architecture Notice */}
      <div className="p-4 rounded-xl bg-card border border-border/70 flex items-start gap-3.5">
        <FileSpreadsheet className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground space-y-1">
          <strong className="text-foreground text-sm block">Memory-Safe Streaming Architecture</strong>
          All reports use backpressured Node.js stream pipelines. Millions of database records are piped row-by-row
          into HTTP responses without buffering huge arrays in Node.js server RAM.
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reports.map((r) => {
          const Icon = r.icon;
          const isDownloading = downloadingType === r.type;

          return (
            <Card key={r.type} className="bg-card border-border flex flex-col justify-between">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${r.bg} ${r.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{r.title}</CardTitle>
                      <Badge variant="outline" className="mt-1 text-[11px] border-border text-muted-foreground">
                        CSV Format &bull; UTF-8
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">{r.description}</p>
                <div className="text-[11px] text-muted-foreground font-mono">
                  Estimated size: {r.estimatedSize}
                </div>

                <Button
                  onClick={() => handleDownload(r.type, r.title)}
                  disabled={isDownloading}
                  className="w-full bg-secondary hover:bg-secondary/80 text-foreground border border-border font-medium"
                >
                  <Download className={`w-4 h-4 mr-2 ${isDownloading ? 'animate-bounce' : ''}`} />
                  {isDownloading ? 'Streaming Export...' : 'Download CSV Report'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
