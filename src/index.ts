import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs';
import readline from "readline-sync";

export const find_channel_urls = async (keywords: string, limit: number) => {
    try{
        const browser = await puppeteer.launch({headless: false});
        let page = await browser.newPage();
        await page.setUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36 Edge/16.16299'
        );
        page.setDefaultNavigationTimeout(1000*60*2);

        await page.goto(`https://www.youtube.com/results?search_query=${encodeURIComponent(keywords)}`)

        let selector = '#contents';

        await page.waitForSelector(selector);

        let results: string[] = [];

        do{

          await autoScroll(page, 2_000);
         
          const el = await page.$(selector);

        
          let videos = (await el?.$$('ytd-video-renderer.style-scope.ytd-item-section-renderer'));
  
          if(!videos) return;
          
          for(let video of videos){            
             let channelLink = (await (await video.$('a.yt-simple-endpoint.style-scope.yt-formatted-string'))?.evaluate(v => v.href))
             
             if(!channelLink) continue;

             if(!results.includes(channelLink)){
              results.push(channelLink);
             }
          }

          console.clear();
          console.log("Channels Found: " + results.length);
      

          //if no more result message comes up, abort
          if(await page.$('#message')) break;

        }while(limit>results.length);

        
        
        await browser.close();

        return results;
    }catch(err: any){
        console.log("Err at find_channel_urls");
        console.log(err);
        throw new Error(err.messagel);
    }
}

export const sort_channel_urls = async (urls: string []) => {
  try{

    const browser = await puppeteer.launch({
      headless: false
    })

    let promises = [];

    let schedule_buffer = [];
    let schedule_index = 0;

    for(let i = 0; urls.length>i; i++){
      schedule_index++;

      schedule_buffer.push(urls[i]);

      if(schedule_index%20 === 0){
        //schedule tasks here

        let promise = get_channel_stats(schedule_buffer, browser);
        promises.push(promise);

        schedule_buffer = [];
      }
    }

    //putting the remaining tasks in. 
    if(schedule_buffer.length != 0){
      let promise = get_channel_stats(schedule_buffer, browser);
      promises.push(promise);

      schedule_buffer = [];
    }


    let results = await Promise.all(promises);

    let final = [];

    for(let result_arr of results){
      for(let res of result_arr){
        final.push(res);
      }
    }

    let sorted = final.sort((a, b) => b.subscribers-a.subscribers);

    await browser.close();
    return sorted.filter(v => v.eligible);
  }catch(err: any){
      console.log("Err at sort_channel_urls");
      console.log(err);
      throw new Error(err.messagel);
  }
}

//it will do a few tabs at a time
export const get_channel_stats = async (urls: string[], browser: Browser) => {
  try{
       let page = await browser.newPage();

       await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36 Edge/16.16299'
      );
      page.setDefaultNavigationTimeout(1000*60*2);
      
      let results = [];

      for(let url of urls){
        try{
          url = url += '/videos';

          await page.goto(url);

          let sub_selector = '#subscriber-count'; 
          let upload_date_selector = 'span.inline-metadata-item.style-scope.ytd-video-meta-block';

          await page.waitForSelector(sub_selector);

          let subscriber_text = await (await page.$(sub_selector))?.evaluate(v => v.innerHTML);
          
          await page.waitForSelector(upload_date_selector)

          let upload_date_text = await (await page.$$(upload_date_selector))[1]?.evaluate(v => v.innerHTML);

          let eligible = true;

          if(upload_date_text.includes('week') || upload_date_text.includes('month') || upload_date_text.includes('year')) eligible = false;

          await page.waitForSelector('#text');

          let name = await (await page.$('#text'))?.evaluate(v => v.innerHTML);

          results.push({
            url: url.replace('/videos', ''),
            subscribers: convertStringToNumber(subscriber_text),
            eligible,
            name
          })
        }catch(err){
        }
      }

      return results;
  }catch(err: any){
      console.log("Err at get_channel_stats");
      console.log(err);
      throw new Error(err.messagel);
  }
}

async function main(){  
  let prompt = readline.question('Enter The Search Phrase: ');

  let limit = Number(readline.question('Amount Of Channels To Be Scanned: '));

  if(Number.isNaN(limit)){
    console.log("Please Enter A Number. Aborting...");
    return; 
  }

  let file_name = readline.question('Save File Name: ');

  let channels = await find_channel_urls(prompt, limit);
  if(!channels){
    console.log("No channels found.");
    return; 
  };

  let sorted = await sort_channel_urls(channels) 
  
  let text = '';

  let i = 0;
  for(let res of sorted){
    i++;
    text += `${i}. ${res.name}    ${res.url}    ${res.subscribers}\n`
  }
  
  const dir = './outputs';
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  fs.writeFileSync(dir + "/" + file_name, text)

  console.log("done");
 }

main();


async function autoScroll(page: Page, limit: number) {

  await page.evaluate(async (limit) => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      let distance = 1_000;
      let timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= limit) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  }, limit);

}

function convertStringToNumber(str: string | undefined) {
  if(!str) return 0;
  
  if(Number.isNaN(Number(str.at(0)))) return 0;

  if(str.split(" ").length>1) str = str.split(" ")[0];


  if (true) {
    const lastChar = str.slice(-1).toLowerCase();
    const numStr = str.slice(0, -1);
    
    switch (lastChar) {
      case 'k':
        return parseFloat(numStr) * 1000;
      case 'm':
        return parseFloat(numStr) * 1000000;
      case 'b':
        return parseFloat(numStr) * 1000000000;
      default:
        return parseFloat(numStr);
    }
  } else {
  }
}
