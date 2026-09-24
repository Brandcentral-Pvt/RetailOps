/**
 * Navigation container ref — lets non-component code (e.g. push notification
 * tap handlers) navigate without a component hook.
 */
import {
  createNavigationContainerRef,
  type NavigationContainerRefWithCurrent,
} from '@react-navigation/native';

export const navigationRef: NavigationContainerRefWithCurrent<
  Record<string, object | undefined>
> = createNavigationContainerRef();