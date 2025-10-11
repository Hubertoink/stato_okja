export default function Dashboard() {
  return (
    <div>
      <h2 className="text-3xl font-bold text-viridian mb-6">Dashboard</h2>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-viridian">
          <h3 className="text-sm text-gray-600 mb-1">Aktivitäten (Monat)</h3>
          <p className="text-3xl font-bold text-viridian">42</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-cambridge-blue">
          <h3 className="text-sm text-gray-600 mb-1">Teilnehmende (Monat)</h3>
          <p className="text-3xl font-bold text-cambridge-blue">387</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-mint-green">
          <h3 className="text-sm text-gray-600 mb-1">Durchschnitt pro Aktivität</h3>
          <p className="text-3xl font-bold text-viridian">9.2</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-viridian">
          <h3 className="text-sm text-gray-600 mb-1">Gesamt-Stunden</h3>
          <p className="text-3xl font-bold text-viridian">124</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h3 className="text-xl font-semibold mb-4 text-viridian">Schnellzugriff</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="bg-viridian text-white px-6 py-3 rounded-lg hover:bg-cambridge-blue transition-colors">
            Neue Aktivität erfassen
          </button>
          <button className="bg-cambridge-blue text-white px-6 py-3 rounded-lg hover:bg-viridian transition-colors">
            Statistik anzeigen
          </button>
          <button className="bg-mint-green text-viridian px-6 py-3 rounded-lg hover:bg-cambridge-blue hover:text-white transition-colors">
            Daten exportieren
          </button>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold mb-4 text-viridian">Letzte Aktivitäten</h3>
        <div className="space-y-3">
          <div className="border-l-4 border-viridian pl-4 py-2 bg-azure-web">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-semibold">Offene Tür</h4>
                <p className="text-sm text-gray-600">Medienraum · 15 Teilnehmende</p>
              </div>
              <span className="text-sm text-gray-500">Heute, 14:30</span>
            </div>
          </div>
          
          <div className="border-l-4 border-cambridge-blue pl-4 py-2 bg-azure-web">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-semibold">Projekt: Graffiti-Workshop</h4>
                <p className="text-sm text-gray-600">Werkraum · 8 Teilnehmende</p>
              </div>
              <span className="text-sm text-gray-500">Gestern, 16:00</span>
            </div>
          </div>

          <div className="border-l-4 border-mint-green pl-4 py-2 bg-azure-web">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-semibold">Veranstaltung: Bandabend</h4>
                <p className="text-sm text-gray-600">Hauptraum · 42 Teilnehmende</p>
              </div>
              <span className="text-sm text-gray-500">02.10.2025</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
