set previewUrl to "http://127.0.0.1:5173/"
set setupJs to "
(() => {
  const finalIndex = ADVENTURE_LEVELS.findIndex(level => level.id === 'final-type-golem');
  const ids = ADVENTURE_LEVELS.slice(0, finalIndex).map(level => level.id);
  localStorage.setItem('wordworm_gamemode', 'adventure');
  localStorage.removeItem('wordworm_save_adventure_v1');
  localStorage.setItem('wordworm_adv_progress', JSON.stringify({
    version: 4,
    completedLevelIds: ids,
    heroLevel: 8,
    heroExp: 0,
    items: { heal: 3, purify: 2, strike: 2 }
  }));
  if (typeof selectGameMode === 'function') selectGameMode('adventure');
  setTimeout(() => startAdventureLevel('final-type-golem'), 350);
  return 'ok';
})();
"

tell application "Google Chrome"
  activate
  if (count of windows) = 0 then make new window
  set URL of active tab of front window to previewUrl
  delay 1.2
  tell active tab of front window to execute javascript setupJs
end tell
