## DISCLAIMER
- **Educational project.** This is a hobby and school project. It is not a commercial product, it is
  not a service, and it is not affiliated with, endorsed by, or sponsored by TwinSpires, Churchill Downs,
  or any related company. All trademarks belong to their owners.
- **It does not store or redistribute TwinSpires data.** The script only reads the race information
  that the user's own browser has already loaded on the page they are viewing, and uses it in memory to
  calculate on-screen numbers. It does not save that data to a server, a database, or the browser's
  storage, and nothing is uploaded or shared. This repository contains no TwinSpires data.
- **It does not run on its own.** It is not a bot, scraper, or crawler. It does nothing unless a person
  opens TwinSpires in their own browser, logs in themselves, and loads a race. It makes no requests of
  its own, does not click or navigate for the user, and does not place bets.
- **Not betting advice.** The numbers are experimental estimates from an unfinished model. Wagering
  involves risk of loss. Use at your own risk.
- **Use responsibly.** Anyone using this is responsible for following TwinSpires' Terms of Use and the
  laws where they live. If TwinSpires or its owner asks for this project to be changed or removed, it
  will be.





  
This is a handicapping model built as an extension to the TwinSpires web page. There is one for use on Windows desktop (I used Microsoft Edge dev tools) and one for iPhone Safari. 

Instructions for Windows:
-> open TwinSpires and log in to your account
-> click on the racetrack and race # you would like it to analyze.
-> press Fn+F12 to open Dev tools in Edge
-> navigate to the "Console" tab
-> copy the desktop code from this repository and paste it in the console
-> press Enter

Instructions for iPhone (mobile):
-> download the app "Userscripts"
-> in your iPhone Safari settings, enable extensions from this app to run in Safari
-> from this repository, download the file named "mobilemodel.user.js". This is a javascript file. Do not try to just copy/paste this code like you can on Windows
-> once downloaded, the file will appear somewhere in your files app
-> in the files app, move it to the "Userscripts" folder. You should see another file named "Demo_user_script.user.js" inside of this folder already from when you downloaded the app
-> open safari, go to twinspires.com, then log in
-> press the puzzle piece icon next to the safari search bar
-> you should see the extension from Userscripts here and you'll be able to run the program. 

There is a pdf document called "How_The_Model_Works" that walks through what calculations, etc. this extension does in real time. It's much easier to read and understand than the code itself.
There is also an in-progress statistical analysis report called "statistical_analysis_horses.pdf" that will be updated once I have more data to work with. There will be a similar file to test the wagering structure eventually. 

Happy gambling, 
John
