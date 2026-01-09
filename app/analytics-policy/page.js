export const metadata = {
    title: "Analytics Policy - SendTheLink",
    description: "Learn about how SendTheLink uses Vercel Analytics to improve user experience while respecting your privacy.",
};

export default function AnalyticsPolicy() {
    return (
        <div className="min-h-screen py-10 px-4 flex justify-center">
            <div className="w-full max-w-3xl glass-card p-8 animate-slide-in">

                {/* Header */}
                <div className="mb-8 border-b border-[var(--border)] pb-6">
                    <a
                        href="/"
                        className="inline-flex items-center text-sm mb-4 text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                            <path d="M19 12H5" />
                            <path d="M12 19l-7-7 7-7" />
                        </svg>
                        Back to Home
                    </a>
                    <h1 className="text-3xl font-bold mb-2">Analytics Policy</h1>
                    <p className="text-[var(--muted-foreground)]">Effective Date: January 10, 2026</p>
                </div>

                {/* Content */}
                <div className="prose prose-invert prose-p:text-[var(--muted-foreground)] prose-headings:text-[var(--foreground)] max-w-none space-y-6">

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-[var(--foreground)]">Introduction</h2>
                        <p className="leading-relaxed">
                            At <strong>SendTheLink</strong>, we believe in transparency and privacy.
                            We use <strong>Vercel Analytics</strong> to understand how our users interact with the website,
                            which helps us improve performance and user experience.
                            This policy explains what data is collected and how it is compliant with privacy standards.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-[var(--foreground)]">What Data is Collected?</h2>
                        <p className="leading-relaxed">
                            Vercel Analytics collects anonymous data about visitors.
                            We do <strong>not</strong> collect any Personally Identifiable Information (PII) such as:
                        </p>
                        <ul className="list-disc pl-5 space-y-1 mt-2 text-[var(--muted-foreground)]">
                            <li>Names</li>
                            <li>Email addresses</li>
                            <li>IP addresses</li>
                            <li>Specific geolocation data (beyond country level)</li>
                        </ul>
                        <p className="mt-3 leading-relaxed">
                            Instead, we track aggregated metrics such as:
                        </p>
                        <ul className="list-disc pl-5 space-y-1 mt-2 text-[var(--muted-foreground)]">
                            <li>Page views and unique visitors</li>
                            <li>Referrer sources (where you came from)</li>
                            <li>Device types and operating systems</li>
                            <li>Country of origin</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-[var(--foreground)]">Privacy-First Approach</h2>
                        <p className="leading-relaxed">
                            Vercel Analytics is designed to be privacy-friendly:
                        </p>
                        <ul className="list-disc pl-5 space-y-1 mt-2 text-[var(--muted-foreground)]">
                            <li><strong>No Cookies:</strong> It does not use cookies to track visitors across sessions or other websites.</li>
                            <li><strong>GDPR Compliant:</strong> Since no PII is collected, it is compliant with GDPR, CCPA, and PECR without requiring a cookie consent banner.</li>
                            <li><strong>Data Ownership:</strong> Usage data belongs to us and is not shared with third-party advertisers.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-[var(--foreground)]">Why We Use Analytics</h2>
                        <p className="leading-relaxed">
                            We use this data solely to:
                        </p>
                        <ul className="list-disc pl-5 space-y-1 mt-2 text-[var(--muted-foreground)]">
                            <li>Monitor website performance and speed.</li>
                            <li>Identify broken links or popular pages.</li>
                            <li>Understand our audience demographics (e.g., country, device) to optimize the design.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-3 text-[var(--foreground)]">Opt-Out</h2>
                        <p className="leading-relaxed">
                            Since Vercel Analytics does not track individuals or use cookies for tracking, typical "Do Not Track" signals are respected where applicable by the platform standard, but there is no specific opt-out button needed as no personal data is at risk.
                        </p>
                    </section>

                    <div className="pt-8 mt-8 border-t border-[var(--border)]">
                        <p className="text-sm text-[var(--muted-foreground)]">
                            If you have any questions about this policy, please contact us at <a href="mailto:fanzirfan@proton.me" className="text-[var(--primary)] hover:underline">fanzirfan@proton.me</a>.
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
}
