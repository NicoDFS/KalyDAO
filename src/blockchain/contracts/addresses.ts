//  Add network-specific addresses
  export const CONTRACT_ADDRESSES_BY_NETWORK = {
    mainnet: {
      GOVERNANCE_TOKEN: "0x4BA2369743c4249ea3f6777CaF433c76dBBa657a",
      GOVERNOR_CONTRACT: "0xF6C1af62e59D3085f10ac6F782cFDaE23E6352dE",
      TIMELOCK: "0xA11572e9724dfeD2BCf8ecc9bfEd18CC609C4c6D",
      TREASURY_VAULT: "0x92564ec0d22BBd5e3FF978B977CA968e6c7d1c44",
      DAO_SETTINGS: "0xeD23Fda4A23C0b6950dEcD55C4Bd757f644E0578",
    },
    testnet: {
      GOVERNANCE_TOKEN: "0x8Ab92A0B7Ec5a9EA877AD3b15bfEFB795aA24C33",
      GOVERNOR_CONTRACT: "0x92177A348367D0122e043448e7f308ba989CFb3F",
      TIMELOCK: "0xAd338da8A2dDE5B5Fe08362c379c66D18Bb24151",
      TREASURY_VAULT: "0x5aE2cf3fC0B99003C64bBDC7836D08064ED43Aab",
      DAO_SETTINGS: "0x14daEbEDf316507ed450fecdA46B059E8037d367",
    },
  } as const;