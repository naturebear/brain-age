import { expect, test } from '@playwright/test'

test('local match switches turns on a miss and records the result', async ({ page }) => {
  await page.clock.install()
  await page.addInitScript(() => { Math.random = () => .99 })
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/#/training')
  await page.getByRole('link', { name: '开始记忆翻牌' }).click()
  await page.getByLabel('对战模式').selectOption('local')
  await page.getByLabel('牌局规模').selectOption('6')
  await page.getByRole('button', { name: '开始对局' }).click()
  await expect(page.getByRole('button', { name: '第 4 行第 6 列，未翻开' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360)
  const card = (index: number) => page.getByRole('button', {
    name: new RegExp('^第 ' + (Math.floor(index / 6) + 1) + ' 行第 ' + (index % 6 + 1) + ' 列'),
  })
  const status = page.getByRole('status')
  await expect(status).toContainText('玩家二')
  await card(0).click()
  await card(2).click()
  await expect(status).toContainText('配对失败')
  await page.clock.runFor(1100)
  await expect(status).toContainText('玩家一')
  for (let index = 0; index < 24; index += 2) {
    await card(index).click()
    await card(index + 1).click()
    await page.clock.runFor(600)
  }
  await expect(status).toHaveText('玩家一获胜')
  await page.getByRole('link', { name: '查看练习记录' }).click()
  await expect(page.getByText('本地双人 · 4×6 · 12:0 · 玩家一获胜')).toBeVisible()
})

test('AI takes over after a missed pair', async ({ page }) => {
  await page.clock.install()
  await page.addInitScript(() => { Math.random = () => .99 })
  await page.goto('/#/training/cards')
  await page.getByLabel('电脑难度').selectOption('hard')
  await page.getByRole('button', { name: '开始对局' }).click()
  await page.getByRole('button', { name: '第 1 行第 1 列，未翻开' }).click()
  await page.getByRole('button', { name: '第 1 行第 3 列，未翻开' }).click()
  await page.clock.runFor(1100)
  await expect(page.getByRole('status')).toHaveText('电脑正在翻牌…')
  await page.clock.runFor(550)
  await expect(page.getByRole('button', { name: /^第 4 行第 4 列，(?!未翻开)/ })).toBeVisible()
})
