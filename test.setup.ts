// @ts-ignore
window.requestIdleCallback = jest.fn().mockImplementation((cb: () => unknown) => {
  return setTimeout(cb, 15)
})
