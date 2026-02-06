import Link from "next/link";

export const dynamic = "force-dynamic";

export default function Home() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || "(missing)";

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>web-next is running</h1>

      <div style={{ marginTop: 12 }}>
        <div>Use these test links:</div>
        <ul>
          <li>
            <Link href="/parts/SMARTHQ1115242">/parts/SMARTHQ1115242</Link>
          </li>
          <li>
            <Link href="/refurb/SMARTHQ1115242">/refurb/SMARTHQ1115242</Link>
          </li>
        </ul>
      </div>

      <div style={{ marginTop: 16 }}>
        <b>NEXT_PUBLIC_API_BASE:</b> {apiBase}
      </div>
    </main>
  );
}
