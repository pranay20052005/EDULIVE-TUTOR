import { Award, CheckCircle2, Download, Printer, ShieldCheck, X } from "lucide-react";
import React, { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toDDMMYYYY } from "@/lib/format";
import type { CourseCertificate } from "@/lib/db/types";

interface CertificateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  certificate: CourseCertificate | null;
}

export function CertificateModal({ open, onOpenChange, certificate }: CertificateModalProps) {
  const printRef = useRef<HTMLDivElement | null>(null);

  if (!certificate) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] p-0 overflow-hidden bg-slate-950 text-slate-100 border border-white/10">
        <DialogHeader className="p-4 border-b border-white/10 flex flex-row items-center justify-between">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Award className="size-5 text-amber-400" /> Certificate of Course Completion
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrint}
              className="h-8 text-xs bg-white/5 border-white/10 hover:bg-white/10"
            >
              <Printer className="size-3.5 mr-1.5" /> Print / Save PDF
            </Button>
          </div>
        </DialogHeader>

        {/* Certificate Canvas Area */}
        <div ref={printRef} className="p-8 bg-gradient-to-b from-slate-900 to-slate-950 relative">
          {/* Border Frame */}
          <div className="relative border-4 border-double border-amber-500/40 rounded-2xl p-8 text-center space-y-6 bg-slate-950/80 shadow-2xl">
            {/* Header Brand */}
            <div className="space-y-1">
              <span className="text-2xl font-bold tracking-widest text-amber-400 font-serif">
                EDULIVE ACADEMY
              </span>
              <p className="text-[11px] uppercase tracking-widest text-slate-400">
                Verified Certificate of Academic Excellence
              </p>
            </div>

            {/* Main Body */}
            <div className="space-y-2 py-4">
              <p className="text-xs text-slate-400 italic">This is proudly presented to</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 font-serif tracking-wide underline decoration-amber-400/50 underline-offset-8">
                {certificate.student_name}
              </h2>
              <p className="text-xs text-slate-300 max-w-md mx-auto pt-4 leading-relaxed">
                for successfully completing the comprehensive curriculum and assessments for{" "}
                <span className="font-semibold text-amber-300">
                  {certificate.course_name} ({certificate.standard} Standard)
                </span>
                .
              </p>
            </div>

            {/* Details Grid & Signatures */}
            <div className="grid grid-cols-3 items-end pt-6 border-t border-white/10 text-xs">
              <div className="text-left space-y-1">
                <p className="text-[10px] text-slate-400">Date of Issue</p>
                <p className="font-medium text-slate-200">
                  {toDDMMYYYY(certificate.issue_date.slice(0, 10))}
                </p>
              </div>

              <div className="flex flex-col items-center">
                <div className="grid size-12 place-items-center rounded-full bg-amber-500/10 border-2 border-amber-500/50 text-amber-400">
                  <ShieldCheck className="size-6" />
                </div>
                <span className="text-[9px] uppercase tracking-wider text-amber-400/80 mt-1">
                  Official Seal
                </span>
              </div>

              <div className="text-right space-y-1">
                <p className="text-[10px] text-slate-400">Certificate ID</p>
                <p className="font-mono text-[11px] font-semibold text-amber-300">
                  {certificate.certificate_number}
                </p>
              </div>
            </div>

            {/* Verification Footer */}
            <p className="text-[10px] text-slate-500 pt-2 flex items-center justify-center gap-1">
              <CheckCircle2 className="size-3 text-emerald-400" /> Tamper-Proof Cryptographic
              Verification
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
