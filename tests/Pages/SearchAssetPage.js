const chalk = require('chalk')
const expect = require('chai').expect

class SearchAssetPage {
  /**
   * Search for an asset from assert view.
   * @param page
   * @param asset
   * @returns {Promise<void>}
   * @constructor
   */
  async SearchForAnAsset (page, asset) {
    await page.waitForSelector('#search_for_a_currency_search', { visible: true })
    await page.type('#search_for_a_currency_search', asset)
    const assertListItems = await page.$$('#assert_list_item')
    await page.waitForTimeout(1000)
    switch (asset) {
      case 'BTC': {
        await page.waitForSelector('#BITCOIN', { visible: true })
        await page.click('#BITCOIN')
        break
      }

      case 'SOV':
      case 'RBTC': {
        const eth = await page.waitForSelector('#RSK', { visible: true })
        await eth.click()
        await page.waitForSelector(`#${asset}`, { visible: true })
        await page.click(`#${asset}`)
        break
      }

      default:
        await assertListItems[0].click()
        await page.click('#' + asset)
    }
    console.log(chalk.blue('User search for assert: ' + asset))
    await page.waitForTimeout(2000)
    expect(await page.$eval('#overview', el => el.innerText), 'SEND/SWAP page not loaded correctly')
      .to.be.oneOf(['SEND', 'SWAP'])
    console.log(chalk.blue('Waiting to load Network fee:' + asset))
    await page.waitForTimeout(10000)
  }
}

module.exports = SearchAssetPage
