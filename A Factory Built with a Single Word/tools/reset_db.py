import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'services', 'api'))

from app.database import SessionLocal
from app.models import (
    User, Project, Scenario, SimulationRun, SimulationSnapshot,
    SimulationTaskRecord, SimulationCargoRecord, SimulationRuntimeLease,
    SimulationRuntimeState, SimulationEventRecord, Evolution,
    ProjectRequestKey, ScenarioRequestKey, ProjectMembership,
    ProjectFile, TemplateEvent, GenerationJob, Notification,
    AuditLog, PasswordResetToken, AuthToken, ScenarioVersion,
)

session = SessionLocal()
demo_ids = ['u-001', 'u-002', 'u-003']

tables_in_order = [
    SimulationRuntimeLease, SimulationRuntimeState,
    SimulationEventRecord, SimulationTaskRecord,
    SimulationCargoRecord, SimulationSnapshot, SimulationRun,
    ScenarioVersion, Scenario, ProjectRequestKey, ScenarioRequestKey,
    ProjectMembership, ProjectFile, Evolution, GenerationJob,
    TemplateEvent, Notification, AuditLog, PasswordResetToken,
    AuthToken, Project,
]

for table in tables_in_order:
    count = session.query(table).delete()
    print(f'Cleared {count} {table.__name__}')

deleted = session.query(User).filter(~User.id.in_(demo_ids)).delete()
print(f'Deleted {deleted} non-demo users')

session.commit()
session.close()

print(f'DB cleaned - keep only 3 demo users')
