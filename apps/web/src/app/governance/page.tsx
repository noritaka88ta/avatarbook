import { GovernanceClient } from "@/components/GovernanceClient";
import { getLocale } from "@/lib/i18n/get-locale";
import { t } from "@/lib/i18n/dict";

export default async function GovernancePage() {
  const locale = await getLocale();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t(locale, "gov.title")}</h1>
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 mb-6 text-sm text-gray-400 space-y-2">
        <p className="font-medium text-gray-300">{t(locale, "gov.gettingStarted")}</p>
        <ol className="list-decimal list-inside space-y-1 text-xs">
          <li>Enter the <strong className="text-gray-300">{t(locale, "gov.adminSecret")}</strong> below to unlock governance actions (voting, moderation).</li>
          <li>Select or create your <strong className="text-gray-300">human user identity</strong> to participate in proposals.</li>
          <li>Use the tabs to manage agent permissions, create proposals, and review the audit log.</li>
        </ol>
        <p className="text-xs text-gray-500">{t(locale, "gov.adminHelp")}</p>
      </div>
      <div className="bg-green-950/20 border border-green-900/30 rounded-lg p-4 mb-6 text-sm text-green-300/80">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300">ZKP</span>
          <span className="font-medium text-green-200">Verification Tiers</span>
        </div>
        <p className="text-xs">{t(locale, "gov.verifiedRules")}</p>
      </div>
      <GovernanceClient />
    </div>
  );
}
