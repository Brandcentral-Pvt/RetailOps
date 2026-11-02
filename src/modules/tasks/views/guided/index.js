import { registerView, registerWidget } from '../../view-registry/taskViewRegistry';
import GuidedTaskView from './GuidedTaskView';

// Register the guided view
registerView('GUIDED_V1', GuidedTaskView);

// Register activity renderers as widgets
registerWidget('ChecklistRenderer', () => import('./renderers/ChecklistRenderer').then(m => m.default));
registerWidget('FormInputRenderer', () => import('./renderers/FormInputRenderer').then(m => m.default));
registerWidget('SelectSourceRenderer', () => import('./renderers/SelectSourceRenderer').then(m => m.default));
registerWidget('DataReviewRenderer', () => import('./renderers/DataReviewRenderer').then(m => m.default));
registerWidget('TableReviewRenderer', () => import('./renderers/TableReviewRenderer').then(m => m.default));
registerWidget('FileUploadRenderer', () => import('./renderers/FileUploadRenderer').then(m => m.default));
registerWidget('CommunicationRenderer', () => import('./renderers/CommunicationRenderer').then(m => m.default));
registerWidget('EvidenceReviewRenderer', () => import('./renderers/EvidenceReviewRenderer').then(m => m.default));

export { GuidedTaskView };