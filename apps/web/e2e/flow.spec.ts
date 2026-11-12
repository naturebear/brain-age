import { expect, test } from '@playwright/test'

test('免登录完成空间记忆，阶段雷达和历史保留结果', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('link', { name: '开始测评' }).click()
  await page.getByRole('button', { name: '继续', exact: true }).click()
  await page.getByLabel('输入方式').selectOption('keyboard')
  await page.getByRole('button', { name: '开始练习' }).click()
  for (const keys of ['15', '73']) {
    await page.clock.runFor(2400)
    for (const key of keys) await page.keyboard.press(key)
    await page.clock.runFor(850)
  }
  await page.getByRole('button', { name: '开始正式测评' }).click()
  await page.clock.runFor(170000)
  await expect(page.getByText('已点亮 2/4')).toBeVisible()
  await page.getByRole('button', { name: '结束测评' }).click()
  await expect(page.getByRole('heading', { name: '部分测评结果' })).toBeVisible()
  await page.reload()
  await expect(page.getByText('已点亮 2/4')).toBeVisible()
})

test('手机宽度可使用正念并在历史中查看练习', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 })
  await page.goto('/#/training/mindfulness')
  await page.getByRole('button', { name: '开始', exact: true }).click()
  await page.getByRole('button', { name: '暂停' }).click()
  await page.getByRole('button', { name: '结束' }).click()
  await page.getByRole('link', { name: '我的记录' }).click()
  await expect(page.getByRole('heading', { name: '正念练习' })).toBeVisible()
})
