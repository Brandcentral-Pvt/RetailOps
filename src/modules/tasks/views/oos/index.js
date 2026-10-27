import { registerView, registerWidget } from '../../view-registry/taskViewRegistry';
import OosTaskView from './OosTaskView';
import OosAffectedAsinsGrid from './components/OosAffectedAsinsGrid';
import OosSourceUploader from './components/OosSourceUploader';
import OosExportPanel from './components/OosExportPanel';
import OosFollowupsTab from './components/OosFollowupsTab';
import OosReviewTab from './components/OosReviewTab';
import OosOverviewTab from './components/OosOverviewTab';

registerView('OOS_RECON_V1', OosTaskView);

registerWidget('OosAffectedAsinsGrid', OosAffectedAsinsGrid);
registerWidget('OosSourceUploader', OosSourceUploader);
registerWidget('OosExportPanel', OosExportPanel);
registerWidget('OosFollowupsTab', OosFollowupsTab);
registerWidget('OosReviewTab', OosReviewTab);
registerWidget('OosOverviewTab', OosOverviewTab);

export { OosTaskView };