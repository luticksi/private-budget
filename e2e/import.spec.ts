import { test, expect } from '@playwright/test'
import path from 'node:path'

const sampleCsv = path.resolve('public/sample-statement.csv')

test('add account, import a CSV, and see categorized transactions locally', async ({ page }) => {
  // 1. Create an account.
  await page.goto('/accounts')
  await page.getByPlaceholder('e.g. Chase Checking').fill('Test Checking')
  await page.getByRole('button', { name: 'Add account' }).click()
  await expect(page.getByText('Test Checking')).toBeVisible()

  // 2. Import the sample statement.
  await page.goto('/import')
  await page.locator('select').first().selectOption({ index: 1 })
  await page.locator('input[type="file"]').setInputFiles(sampleCsv)
  await expect(page.getByText(/transaction\(s\) ready/)).toBeVisible()
  await page.getByRole('button', { name: /Import \d+ transaction/ }).click()
  await expect(page.getByText(/Imported/)).toBeVisible()

  // 3. Transactions appear, with a normalized merchant name.
  await page.goto('/transactions')
  await expect(page.getByText('Blue Bottle Oakland')).toBeVisible()

  // 4. Reports compute a category breakdown.
  await page.goto('/reports')
  await expect(page.getByText('Spending by category')).toBeVisible()
  await expect(page.getByText('Food & Dining')).toBeVisible()

  // 5. Trust check: the header badge confirms no data left the device.
  await expect(page.getByText('No data has left this device')).toBeVisible()
})
