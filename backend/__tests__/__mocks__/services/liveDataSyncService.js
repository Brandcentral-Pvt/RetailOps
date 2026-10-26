module.exports = {
  syncSellerLiveData: jest.fn().mockResolvedValue({
    success: true,
    updatedAsins: 1,
    failedAsins: 0,
    pendingAsinsCount: 0,
  }),
};
