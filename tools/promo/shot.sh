#!/bin/bash
# Takes one store screenshot from the iOS simulator, with the app opened
# straight onto a screen (and, for games, playing itself; see demo_patch.py).
# Every source file it patches is restored afterwards.
#
# shot.sh <name> <kind> <value> <seconds> <demo-mode> [interval] [extra sed for ShopScreen]
#   kind: game (value kind/puzzleId) | route (value overlay route) | home | launch
#   seconds: how long after launch to take the shot
set -m
cd /Users/marisdenis/DEV/gravity-the-game
DIR="$(cd "$(dirname "$0")" && pwd)/work"; mkdir -p "$DIR/shots" "$DIR/bak"
APP=com.marisdenis.tessera; UDID=C9576356-39D7-468D-9715-09988C8CD6FF
NAME=$1; KIND=$2; VALUE=$3; SECS=$4; MODE=$5; INTERVAL=${6:-700}; SHOP_SED=$7
FILES="App.tsx src/ads/index.ts src/components/InsightPower.tsx src/progression/coins.ts src/screens/HomeScreen.tsx src/components/HintNote.tsx src/components/PuzzleSolved.tsx src/screens/*Screen.tsx"
tar -cf $DIR/bak/shot.tar $FILES
python3 "$(dirname "$0")/demo_patch.py" $MODE $INTERVAL
sed -i '' 's/const \[launched, setLaunched\] = useState(false);/const [launched, setLaunched] = useState(true);/' App.tsx
case $KIND in
  route) sed -i '' "s/const \[overlayRoute, setOverlayRoute\] = useState<OverlayRoute>(null);/const [overlayRoute, setOverlayRoute] = useState<OverlayRoute>('$VALUE');/" App.tsx ;;
  game) g=${VALUE%%/*}; id=${VALUE#*/}; sed -i '' "s/const \[selected, setSelected\] = useState<Selected | null>(null);/const [selected, setSelected] = useState<Selected | null>({ kind: '$g', puzzleId: '$id' });/" App.tsx ;;
  launch) sed -i '' 's/const \[launched, setLaunched\] = useState(true);/const [launched, setLaunched] = useState(false);/' App.tsx ;;
  home) ;;
esac
[ -n "$SHOP_SED" ] && sed -i '' "$SHOP_SED" src/screens/ShopScreen.tsx
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output $DIR/main.jsbundle --assets-dest $DIR/assets >$DIR/bundle.log 2>&1
OK=$?
tar -xf $DIR/bak/shot.tar
if [ $OK -ne 0 ]; then echo "BUNDLE FAIL $NAME"; tail -5 $DIR/bundle.log; exit 1; fi
cp $DIR/main.jsbundle "$(xcrun simctl get_app_container $UDID $APP)/main.jsbundle"
xcrun simctl terminate $UDID $APP 2>/dev/null; sleep 1
xcrun simctl launch $UDID $APP >/dev/null
sleep $SECS
xcrun simctl io $UDID screenshot $DIR/shots/$NAME.png >/dev/null 2>&1
echo "shot $NAME"
