import { registerView } from '../../view-registry/taskViewRegistry';
import GenericTaskView from './GenericTaskView';

// Register the standard fallback view used when no specialized view is configured
registerView('STANDARD_V1', GenericTaskView);

export { GenericTaskView };