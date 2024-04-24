import express from 'express';
import { activities, download_speeds, upload_speeds } from '../../../Libp2p/utils.js';

const stats = express.Router();

stats.get('/transaction', async (req, res) => {
   let statusCode = 200;
   let message = '';
   const { pub_key } = req.body;
   const node = req.node;
   try {
      const currentTimeInSeconds = Math.floor(Date.now() / 1000);
      const uploadKBS = ((upload_speeds[currentTimeInSeconds] ? upload_speeds[currentTimeInSeconds] : 0)
         + (upload_speeds[currentTimeInSeconds - 1] ? upload_speeds[currentTimeInSeconds - 1] : 0)) / 2000;
      const downloadKBS = ((download_speeds[currentTimeInSeconds] ? download_speeds[currentTimeInSeconds] : 0)
         + (download_speeds[currentTimeInSeconds - 1] ? download_speeds[currentTimeInSeconds - 1] : 0)) / 2000;
      message = {
         _id: node.peerId.toString(),
         pub_key,
         upload_speed: uploadKBS,
         download_speed: downloadKBS
      }
   } catch (error) {
      statusCode = 500;
      message = "Error";
   }

   res.status(statusCode).send(message);
});

stats.get('/types', async (req, res) => {
   let statusCode = 200;
   let message = '';
   const { pub_key } = req.body;
   const node = req.node;
   try {
      const allActivities = activities.uploads.concat(activities.downloads);
      const fileTypeCounts = allActivities.reduce((counts, activity) => {
         counts[activity.fileType] = (counts[activity.fileType] || 0) + 1;
         return counts;
      }, {});
      message = {
         _id: node.peerId.toString(),
         pub_key,
         filetype: Object.keys(fileTypeCounts),
         filetypeNumber: [fileTypeCounts]
      }
   } catch (error) {
      console.log(error)
      statusCode = 500;
      message = "Error";
   }

   res.status(statusCode).send(message);
});

stats.get('/activity', async (req, res) => {
   let statusCode = 200;
   let message = '';
   const { pub_key } = req.body;
   const node = req.node;
   try {
      function aggregateActivities(activities, type) {
         const aggregatedActivities = {};
         activities.forEach(activity => {
            const { date } = activity;
            if (!aggregatedActivities[date]) {
               aggregatedActivities[date] = { download: 0, upload: 0 };
            }
            if (type === "downloads") {
               aggregatedActivities[date].download++;
            } else {
               aggregatedActivities[date].upload++;
            }
         });
         return aggregatedActivities;
      }
      const uploads = aggregateActivities(activities.uploads, 'uploads');
      const downloads = aggregateActivities(activities.downloads, 'downloads');
      // Get all unique dates from uploads and downloads
      const allDates = Array.from(new Set([...Object.keys(uploads), ...Object.keys(downloads)]));
      message = {
         _id: node.peerId.toString(),
         pub_key,
         activities: allDates.map(date => ({
            date,
            download: (downloads[date] && downloads[date].download) || 0,
            upload: (uploads[date] && uploads[date].upload) || 0
         }))
      }
   } catch (error) {
      console.log(error)
      statusCode = 500;
      message = "Error";
   }

   res.status(statusCode).send(message);
});

export default stats;