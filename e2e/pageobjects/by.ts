import { $ } from '@wdio/globals';

const INVALID_ANDROID_RESOURCE_ID_CHARACTER_PATTERN = /[^A-Za-z0-9_]/g;
const APP_SCROLL_VIEW_RESOURCE_ID = 'app_scroll_view';

export type TodoTestIDPart =
  | 'card'
  | 'toggle_checkbox'
  | 'title_text'
  | 'status_text'
  | 'edit_title_input'
  | 'save_edit_button'
  | 'cancel_edit_button'
  | 'photo_button'
  | 'photo_image'
  | 'location_button'
  | 'location_button_text'
  | 'coordinates_text'
  | 'edit_button'
  | 'delete_button'
  | 'pending_summary_text'
  | 'completed_summary_text';

export function testIDSelector(testID: string) {
  const androidResourceID = toAndroidResourceID(testID);

  return `android=new UiSelector().resourceId("${escapeUiAutomatorString(androidResourceID)}")`;
}

export function byTestID(testID: string) {
  return $(testIDSelector(testID));
}

export function byTodoTestIDPart(part: TodoTestIDPart) {
  const suffix = escapeRegex(`_${part}`);
  const resourceIDPattern = `^todo_.*${suffix}$`;

  return $(
    `android=new UiScrollable(new UiSelector().resourceId("${APP_SCROLL_VIEW_RESOURCE_ID}")).scrollIntoView(new UiSelector().resourceIdMatches("${escapeUiAutomatorString(resourceIDPattern)}"))`
  );
}

function toAndroidResourceID(testID: string) {
  if (testID.trim().length === 0) {
    throw new Error('testID must not be empty');
  }

  return testID.replace(INVALID_ANDROID_RESOURCE_ID_CHARACTER_PATTERN, '_');
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeUiAutomatorString(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
