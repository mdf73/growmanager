import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Statistiques from './pages/Statistiques'
import Graines from './pages/Graines'
import Culture from './pages/Culture'
import Stock from './pages/Stock'
import Extractions from './pages/Extractions'
import Amendements from './pages/Amendements'
import HistoriqueCultures from './pages/HistoriqueCultures'
import Materiel from './pages/Materiel'
import Parametrage from './pages/Parametrage'
import ExtractionsHash from './pages/ExtractionsHash'
import RecettesSchemas from './pages/RecettesSchemas'
import RecettesTCO from './pages/RecettesTCO'
import RecettesLSO from './pages/RecettesLSO'
import RecettesReamendement from './pages/RecettesReamendement'
import RecettesFermentation from './pages/RecettesFermentation'
import RecettesArrosage from './pages/RecettesArrosage'
import SuiviSolsVivants from './pages/SuiviSolsVivants'
import EspacesCulture from './pages/EspacesCulture'
import SechageCuring from './pages/SechageCuring'
import Croisement from './pages/Croisement'
import SuiviConstantes from './pages/SuiviConstantes'
import PlanCulture from './pages/PlanCulture'
import PreparationSubstrat from './pages/PreparationSubstrat'
import ClassementVarietes from './pages/ClassementVarietes'
import Consommation from './pages/Consommation'

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/statistiques" element={<Statistiques />} />
          <Route path="/graines" element={<Graines />} />
          <Route path="/culture" element={<Culture />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/classement-varietes" element={<ClassementVarietes />} />
          <Route path="/extractions" element={<Extractions />} />
          <Route path="/amendements" element={<Amendements />} />
          <Route path="/historique-cultures" element={<HistoriqueCultures />} />
          <Route path="/extractions-hash" element={<ExtractionsHash />} />
          <Route path="/recettes/schemas-engrais" element={<RecettesSchemas />} />
          <Route path="/recettes/tco" element={<RecettesTCO />} />
          <Route path="/recettes/lso" element={<RecettesLSO />} />
          <Route path="/recettes/reamendement" element={<RecettesReamendement />} />
          <Route path="/recettes/fermentation" element={<RecettesFermentation />} />
          <Route path="/recettes/arrosage" element={<RecettesArrosage />} />
          <Route path="/suivi-sols-vivants" element={<SuiviSolsVivants />} />
          <Route path="/espaces-culture" element={<EspacesCulture />} />
          <Route path="/sechage-curing" element={<SechageCuring />} />
          <Route path="/croisement" element={<Croisement />} />
          <Route path="/suivi-constantes" element={<SuiviConstantes />} />
          <Route path="/plan-culture" element={<PlanCulture />} />
          <Route path="/preparation-substrat" element={<PreparationSubstrat />} />
          <Route path="/materiel" element={<Materiel />} />
          <Route path="/parametrage" element={<Parametrage />} />
          <Route path="/consommation" element={<Consommation />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
