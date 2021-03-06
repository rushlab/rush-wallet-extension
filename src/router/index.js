import Vue from 'vue'
import VueRouter from 'vue-router'

import Splash from '@/views/Splash.vue'
import OnboardingSetup from '@/views/Onboarding/OnboardingSetup.vue'
import ImportWallet from '@/views/ImportWallet.vue'
import UnlockWallet from '@/views/UnlockWallet.vue'
import Wallet from '@/views/Wallet/Wallet.vue'
import Account from '@/views/Account.vue'
import TransactionDetails from '@/views/Details/TransactionDetails.vue'
import Send from '@/views/Send/Send.vue'
import Receive from '@/views/Receive.vue'

import Settings from '@/views/Settings'
import ManageAssets from '@/views/ManageAssets'
import CustomToken from '@/views/CustomToken'

import RequestUnlockWallet from '@/views/RequestUnlockWallet.vue'
import Enable from '@/views/Enable.vue'
import PermissionSend from '@/views/PermissionSend.vue'
import PermissionSign from '@/views/PermissionSign.vue'

import Permission from '@/views/Permission.vue'
import WalletAssets from '@/views/Wallet/WalletAssets.vue'
import WalletActivity from '@/views/Wallet/WalletActivity.vue'
import AssetList from '@/views/AssetList.vue'
import CreateAccount from '@/views/Accounts/Create.vue'
import ImportAccount from '@/views/Accounts/Import.vue'

import Warning from '@/views/Onboarding/SeedPhrase/Warning.vue'
import LoginPhrase from '@/views/Onboarding/SeedPhrase/LoginPhrase.vue'
import PhraseReveal from '@/views/Onboarding/SeedPhrase/PhraseReveal'

import AddProxyAddress from '@/views/ProxyAddress/Add'
import OwnerKeys from '@/views/OwnerKeys/OwnerKeys'
import AddOwnerKey from '@/views/OwnerKeys/AddOwnerKey'

import Owners from '@/views/Owners/Owners'
import AddOwner from '@/views/Owners/AddOwner'


Vue.use(VueRouter)

const routes = [
  // Onboarding
  {
    path: '/',
    component: Splash
  },
  {
    path: '/onboarding/import',
    component: ImportWallet
  },
  {
    path: '/open',
    component: UnlockWallet
  },
  {
    path: '/onboarding/setup/:passphrase?',
    component: OnboardingSetup,
    name: 'OnboardingSetup',
    props: true
  },
  // Onboarding

  // Settings
  {
    path: '/settings',
    component: Settings
  },
  {
    path: '/settings/manage-assets',
    component: ManageAssets
  },
  {
    path: '/settings/manage-assets/custom-token',
    component: CustomToken
  },
  // Settings

  // Wallet
  {
    path: '/wallet',
    name: 'Wallet',
    component: Wallet,
    children: [
      {
        path: 'assets',
        component: WalletAssets,
        name: 'WalletAssets'
      },
      {
        path: 'activity',
        component: WalletActivity,
        name: 'WalletActivity'
      },
      {
        path: '',
        redirect: 'assets'
      }
    ]
  },
  // proxy addresses
  {
    path: '/proxy-address/add',
    component: AddProxyAddress,
    name: 'AddProxyAddress'
  },
  // owners
  {
    path: '/owners',
    name: 'Owners',
    component: Owners
  },
  {
    path: '/owners/add',
    name: 'AddOwner',
    component: AddOwner
  },
  // owner keys
  {
    path: '/owner-keys',
    name: 'OwnerKeys',
    component: OwnerKeys
  },
  {
    path: '/owner-keys/add',
    name: 'AddOwnerKey',
    component: AddOwnerKey
  },
  // Details
  {
    path: '/details/transaction/:id',
    component: TransactionDetails,
    name: 'TransactionDetails',
    props: true
  },

  // Accounts
  {
    path: '/accounts/create',
    component: CreateAccount,
    props: true
  },
  {
    path: '/accounts/import',
    component: ImportAccount,
    props: true
  },
  {
    name: 'Account',
    path: '/accounts/:accountId/:asset',
    component: Account,
    props: true
  },
  {
    name: 'Send',
    path: '/accounts/:accountId/:asset/send',
    component: Send,
    props: true
  },
  {
    name: 'Receive',
    path: '/accounts/:accountId/:asset/receive',
    component: Receive,
    props: true
  },
  // Assets list
  {
    path: '/assets/:action',
    component: AssetList,
    props: true
  },
  // Wallet

  // Injection
  {
    path: '/request-unlock',
    component: RequestUnlockWallet
  },
  {
    path: '/enable',
    component: Enable
  },
  {
    path: '/permission/send',
    component: PermissionSend
  },
  {
    path: '/permission/sign',
    component: PermissionSign
  },
  {
    path: '/permission/default',
    component: Permission
  },
  // Injection

  // SeedPhrase
  {
    path: '/privacywarning',
    component: Warning
  },
  {
    path: '/seedlogin',
    component: LoginPhrase
  },
  {
    path: '/seedreveal',
    component: PhraseReveal
  }

]

const router = new VueRouter({
  base: process.env.BASE_URL,
  routes
})

export default router
