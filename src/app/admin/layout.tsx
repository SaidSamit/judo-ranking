// ==============================================================================
// LAYOUT: PANEL ADMINISTRATIVO Y GESTIÓN DE TORNEO (ENTERPRISE SHELL)
// ==============================================================================

import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminTopHeader } from '@/components/admin/admin-top-header';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const adminRole = cookieStore.get('judo_admin_role')?.value;

  if (!adminRole) {
    redirect('/');
  }
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-amber-500 selection:text-slate-950 print:bg-white print:text-black">
      {/* BARRA LATERAL PROFESIONAL */}
      <div className="print:hidden">
        <AdminSidebar />
      </div>

      {/* ÁREA DE CONTENIDO PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0 print:p-0 print:m-0">
        <div className="print:hidden">
          <AdminTopHeader />
        </div>
        <main className="flex-1 overflow-y-auto print:overflow-visible">
          {children}
        </main>
      </div>
    </div>
  );
}
