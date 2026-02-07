import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await page.getByRole('button', { name: 'Dev Login (Bypass)' }).click();
  await page.getByRole('button', { name: 'YOUTUBE' }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'YOUTUBE' }).click();
  await page.getByRole('textbox', { name: 'Search videos...' }).click();
  await page.getByRole('textbox', { name: 'Search videos...' }).fill('sample');
  await page.getByRole('textbox', { name: 'Search videos...' }).press('Enter');
  await page.getByRole('img', { name: 'Sample Breakdown: Linkin Park' }).click();
  await page.getByRole('slider').nth(1).fill('20');
  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByRole('button', { name: 'Chat' }).click();
  await page.getByRole('textbox', { name: 'Type a message... (Paste' }).click();
  await page.getByRole('textbox', { name: 'Type a message... (Paste' }).fill('hiiiii');
  await page.getByRole('textbox', { name: 'Type a message... (Paste' }).press('Enter');
  await page.getByRole('slider').first().fill('2');
  await page.getByRole('button', { name: 'Dashboard' }).click();
  await page.getByRole('button', { name: '✕' }).click();
  await page.getByRole('button', { name: 'Force Sync' }).click();
  await page.getByRole('button', { name: 'Lock Controls' }).click();
  await page.getByRole('button', { name: 'Lock Controls' }).click();
});