<template>
  <div class="wallet">
    <NavBar showMenu="true">
      <span class="wallet-header">
        <strong>Overview</strong>
      </span>
    </NavBar>
    <div class="wallet-content">
      <WalletStats :loading="loadingBalances"/>
      <AssetsChart />
      <WalletTabs />
    </div>
  </div>
</template>

<script>
import { mapActions, mapGetters, mapState } from 'vuex'
import { isERC20 } from '@/utils/asset'
import AssetsChart from './AssetsChart.vue'
import NavBar from '@/components/NavBar.vue'
import InfoNotification from '@/components/InfoNotification.vue'
import WalletStats from './WalletStats.vue'
import WalletTabs from './WalletTabs.vue'

export default {
  components: {
    AssetsChart,
    NavBar,
    WalletStats,
    WalletTabs,
    InfoNotification,
  },
  data () {
    return {
      // loadingBalances: false
    }
  },
  async created () {
    // this.loadingBalances = true
    try {
      await this.updateProxyAddressAccountBalances()
    } catch (error) {
      // TODO: manage error
      console.error(error)
    } finally {
      // this.loadingBalances = false
    }
  },
  computed: {
    ...mapState(['activeNetwork', 'activeWalletId', 'history', 'loadingBalances']),
    ...mapGetters(['accountItem']),
  },
  methods: {
    ...mapActions(['updateBalances', 'updateProxyAddressAccountBalances'])
  }
}
</script>

<style lang="scss">
.wallet {
  display: flex;
  flex-direction: column;
  height: 600px;
  padding-bottom: 44px;

  .wallet-content {
     overflow: auto;
   }

  .wallet-header {
    font-weight: normal;
    text-transform: uppercase;
  }
}
</style>
