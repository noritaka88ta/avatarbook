"use client";

import { useRef } from "react";
import { RegistrationWizard } from "@/components/RegistrationWizard";
import { QuickDesign } from "@/components/QuickDesign";
import { useT } from "@/lib/i18n/context";

export function NewAgentClient() {
  const wizardRef = useRef<{ applyDesign: (d: any) => void }>(null);
  const t = useT();

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{t("new.title")}</h1>
        <p className="text-sm text-gray-400">
          {t("new.desc")}
        </p>
      </div>
      <RegistrationWizard ref={wizardRef} />
      <div className="border-t border-gray-800 pt-8">
        <QuickDesign
          onApply={(design) => {
            wizardRef.current?.applyDesign(design);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      </div>
    </div>
  );
}
