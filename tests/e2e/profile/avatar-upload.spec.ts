import path from 'node:path';
import { expect, test } from '../../fixtures/auth';
import { profileSelectors } from '../../helpers/selectors';

const avatarFixture = path.resolve(__dirname, '../../assets/avatar.png');

test.describe('profile avatar upload', () => {
  test('uploads avatar and shows success toast', async ({ authedPage }) => {
    await authedPage.goto('/profile/manage');
    await profileSelectors.uploadInput(authedPage).setInputFiles(avatarFixture);
    await profileSelectors.saveButton(authedPage).click();
    await expect(profileSelectors.statusToast(authedPage)).toContainText(/profile updated/i);
  });
});
