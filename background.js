/* เมื่อ popup ปิด ให้ service worker ซิงก์ draft ที่ค้างอยู่ขึ้น chrome.storage.sync */
importScripts('js/storage.js');

chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'nota-ui') return;
  port.onDisconnect.addListener(async () => {
    await Store.loadAll();
    if (Store.hasDrafts()) await Store.flush();
  });
});
