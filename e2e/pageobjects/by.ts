import { $ } from '@wdio/globals';

const DEFAULT_ANDROID_APP_PACKAGE = 'com.alisto.app';
const INVALID_ANDROID_RESOURCE_ID_CHARACTER_PATTERN = /[^A-Za-z0-9_]/g;

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

export const androidAppPackage =
  process.env.ALISTO_ANDROID_APP_PACKAGE ?? DEFAULT_ANDROID_APP_PACKAGE;

export function testIDSelector(testID: string) {
  if (testID.trim().length === 0) {
    throw new Error('testID must not be empty');
  }

  const androidResourceID = testID.replace(INVALID_ANDROID_RESOURCE_ID_CHARACTER_PATTERN, '_');
  return `id=${androidAppPackage}:id/${androidResourceID}`;
}

export function byTestID(testID: string) {
  return $(testIDSelector(testID));
}

export function byTodoTestIDPart(part: TodoTestIDPart) {
  const packagePrefix = escapeRegex(`${androidAppPackage}:id/todo_`);
  const suffix = escapeRegex(`_${part}`);

  return $(`android=new UiSelector().resourceIdMatches("${packagePrefix}.*${suffix}")`);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
