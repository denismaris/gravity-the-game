#!/bin/bash
# Records one scene of the promo from the iOS simulator, with the app in a
# temporary demo mode (games play themselves; see demo_patch.py). Every
# source file it patches is restored afterwards.
#
# record.sh <name> <kind> <value> <seconds> <demo-mode> [interval]
#   kind: game (value kind/puzzleId) | route (value overlay route) | launch | home
#   demo-mode: auto (games autoplay) | home (carousel turns itself) | none
#
# Then: ffmpeg -i work/raw/<name>.mov -vf fps=30,format=yuv420p work/cfr/<name>.mp4
# and python3 make_promo.py
set -m  # job control, so the recorder gets the SIGINT that ends it
cd /Users/marisdenis/DEV/gravity-the-game
DIR="$(cd "$(dirname "$0")" && pwd)/work"; mkdir -p "$DIR/raw" "$DIR/cfr" "$DIR/bak"
APP=com.marisdenis.tessera; UDID=C9576356-39D7-468D-9715-09988C8CD6FF
NAME=$1; KIND=$2; VALUE=$3; SECS=$4; MODE=$5; INTERVAL=${6:-700}
FILES="App.tsx src/progression/coins.ts src/screens/HomeScreen.tsx src/components/HintNote.tsx src/components/PuzzleSolved.tsx src/screens/*Screen.tsx"
tar -cf $DIR/bak/tree.tar $FILES
python3 "$(dirname "$0")/demo_patch.py" $MODE $INTERVAL
sed -i '' 's/const \[launched, setLaunched\] = useState(false);/const [launched, setLaunched] = useState(true);/' App.tsx
case $KIND in
  route) sed -i '' "s/const \[overlayRoute, setOverlayRoute\] = useState<OverlayRoute>(null);/const [overlayRoute, setOverlayRoute] = useState<OverlayRoute>('$VALUE');/" App.tsx ;;
  game) g=${VALUE%%/*}; id=${VALUE#*/}; sed -i '' "s/const \[selected, setSelected\] = useState<Selected | null>(null);/const [selected, setSelected] = useState<Selected | null>({ kind: '$g', puzzleId: '$id' });/" App.tsx ;;
  launch) sed -i '' 's/const \[launched, setLaunched\] = useState(true);/const [launched, setLaunched] = useState(false);/' App.tsx ;;
  home) ;;
esac
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output $DIR/main.jsbundle --assets-dest $DIR/assets >$DIR/bundle.log 2>&1
OK=$?
tar -xf $DIR/bak/tree.tar
if [ $OK -ne 0 ]; then echo "BUNDLE FAIL $NAME"; tail -5 $DIR/bundle.log; exit 1; fi
cp $DIR/main.jsbundle "$(xcrun simctl get_app_container $UDID $APP)/main.jsbundle"
xcrun simctl terminate $UDID $APP 2>/dev/null; sleep 1
rm -f $DIR/raw/$NAME.mov
xcrun simctl io $UDID recordVideo --codec=h264 --force $DIR/raw/$NAME.mov >/dev/null 2>&1 &
REC=$!
sleep 1.2
xcrun simctl launch $UDID $APP >/dev/null
sleep $SECS
kill -INT $REC; wait $REC 2>/dev/null
echo "recorded $NAME $(ffprobe -v error -show_entries format=duration -of csv=p=0 $DIR/raw/$NAME.mov)s"
