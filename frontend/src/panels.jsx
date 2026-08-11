import { createContext, useContext, useState } from "react";
import ProjectDetailPanel from "./components/ProjectDetailPanel";
import EmployeeDetailPanel from "./components/EmployeeDetailPanel";

const PanelContext = createContext({ openProject: () => {}, openEmployee: () => {} });

export function PanelProvider({ user, children }) {
  const [projectId, setProjectId] = useState(null);
  const [employeeId, setEmployeeId] = useState(null);

  return (
    <PanelContext.Provider value={{ openProject: setProjectId, openEmployee: setEmployeeId }}>
      {children}
      <ProjectDetailPanel projectId={projectId} user={user} onClose={() => setProjectId(null)} />
      <EmployeeDetailPanel employeeId={employeeId} user={user} onClose={() => setEmployeeId(null)} />
    </PanelContext.Provider>
  );
}

export function usePanels() {
  return useContext(PanelContext);
}
