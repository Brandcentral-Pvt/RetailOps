import { registerView, registerWidget } from '../../view-registry/taskViewRegistry';
import OosTaskView from './OosTaskView';
import OosAffectedAsinsGrid from './components/OosAffectedAsinsGrid';
import OosSourceUploader from './components/OosSourceUploader';
import OosExportPanel from './components/OosExportPanel';
import OosFollowupsTab from './components/OosFollowupsTab';
import OosReviewTab from './components/OosReviewTab';
import OosOverviewTab from './components/OosOverviewTab';

registerView('OOS_RECON_V1', OosTaskView);

registerWidget('OosAffectedAsinsGrid', null); // Will be imported dynamically
registerWidget('OosSourceUploader', null);
registerWidget('OosExportPanel', null);
registerWidget('OosFollowupsTab', null);
registerWidget('OosReviewTab', null);
registerWidget('OosOverviewTab', null);

export { OosTaskView };