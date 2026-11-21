import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale/fr'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formaterMontant } from '../../domain/argent'
import type { PointValeur } from '../../domain/biens'
import { montantCompact } from '../../domain/projection'
import type { Devise } from '../../domain/types'

/** Courbe de la valeur totale des biens (chargée à part, avec la bibliothèque de graphiques). */
export default function CourbeBiens({ points, devise }: { points: PointValeur[]; devise: Devise }) {
  return (
    <section className="rounded-carte bg-white px-2 pb-2 pt-3 shadow-carte" aria-label={`Évolution de la valeur des biens (${devise})`}>
      <p className="px-2 text-[15px] font-semibold text-encre">Valeur des biens{devise === 'EUR' ? ' (€)' : ''}</p>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#E3E7ED" />
            <XAxis dataKey="date" tickFormatter={(d) => format(parseISO(String(d)), 'MMM yy', { locale: fr }).replace('.', '')} tick={{ fontSize: 11, fill: '#98A0AE' }} tickLine={false} axisLine={{ stroke: '#E3E7ED' }} minTickGap={28} />
            <YAxis tickFormatter={(v) => montantCompact(v)} tick={{ fontSize: 11, fill: '#98A0AE' }} tickLine={false} axisLine={false} width={40} />
            <Tooltip cursor={{ stroke: '#98A0AE', strokeWidth: 1 }} content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <div className="rounded-[10px] bg-white px-3 py-2 text-[13px] shadow-carte ring-1 ring-trait">
                  <p className="text-encre-douce">{format(parseISO(String(label)), 'd MMMM yyyy', { locale: fr })}</p>
                  <p className="font-semibold text-encre">{formaterMontant((payload[0].payload as PointValeur).valeur, devise)}</p>
                </div>
              )
            }} />
            <Line type="linear" dataKey="valeur" stroke="#2F6FED" strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
