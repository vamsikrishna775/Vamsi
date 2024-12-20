require('dotenv').config(); // To manage environment variables
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const userRoutes = require('./routes/userRoutes'); // Import the user routes

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Parse JSON requests

// Set the upload directory (e.g., E:/uploads or D:/uploads)
const uploadPath = 'E:/uploads'; // Adjust this path as needed

// Ensure the upload folder exists
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + '-' + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Failed to connect to MongoDB:', err));

// Use user routes
app.use('/api/users', userRoutes);

// Serve static files from the "uploads" folder (for PDF access)
app.use('/uploads', express.static(uploadPath));

// Path to your JADX executable
const jadxPath = `"D:\\SIH\\jadx-gui-1.5.1.exe"`; // Updated path to JADX

// Cache directory path (specific to your environment)
const cacheDir = `C:\\Users\\VAMSI KRISHNA\\AppData\\Local\\skylot\\jadx\\cache\\projects`;

// Endpoint for uploading APK files
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  const apkPath = path.join(uploadPath, req.file.filename);
  const outputDir = path.join(uploadPath, 'decompiled_output'); // Directory for decompiled code

  // Log the paths being used
  console.log('APK Path:', apkPath);
  console.log('Output Directory:', outputDir);

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log('Output directory created:', outputDir);
  }

  // Run JADX to decompile the APK
  const jadxProcess = exec(`"${jadxPath}" -d "${outputDir}" "${apkPath}"`, (err, stdout, stderr) => {
    if (err) {
      console.error(`Error during decompilation: ${stderr}`);
      return res.status(500).json({ message: 'Error decompiling APK.' });
    }


    // Check if files exist in the cache directory
    if (fs.existsSync(cacheDir)) {

      // Read the cache directory and copy files
      fs.readdir(cacheDir, (readErr, files) => {
        if (readErr) {
          console.error(`Error reading cache directory: ${readErr}`);
          return res.status(500).json({ message: 'Error reading cache directory.', error: readErr });
        }

        // Copy each file or folder from cache to the output directory
        files.forEach((file) => {
          const sourcePath = path.join(cacheDir, file);
          const destPath = path.join(outputDir, file);

          fs.cp(sourcePath, destPath, { recursive: true }, (copyErr) => {
            if (copyErr) {
              console.error(`Error copying file: ${sourcePath} -> ${destPath}:`, copyErr);
            } else {
              console.log(`Copied: ${sourcePath} -> ${destPath}`);
            }
          });
        });

        // Send success response after all files are copied
        res.status(200).json({
          message: 'APK file uploaded and decompiled successfully.',
          decompiledCodePath: `/uploads/decompiled_output/`, 
          fileName:req.file.filename
        });
        console.log("uploaded",req.file.filename)
      });
    } else {
      // If files are not in cache, assume outputDir was used
      res.status(200).json({
        message: 'APK file uploaded and decompiled successfully.',
        decompiledCodePath: `/uploads/decompiled_output/`,
      });
    }
  });

  // Close the JADX GUI after decompilation is complete
  jadxProcess.on('exit', () => {
    console.log('jadx process has exited.');
    // Optionally kill the process if needed
    jadxProcess.kill();
  });
});



app.post('/api/read-java-file', (req, res) => {
  const { filename } = req.body;
  console.log(filename, "filename");

  // Remove the last '-app-debug.apk' portion from the filename
  const modifiedFilename = filename.replace(/-app-debug\.apk$/, '');
  console.log(modifiedFilename, "modifiedFilename");

  // Path to the parent directory containing the output folders
  const outputDir = path.join('E:\\uploads\\decompiled_output');

  try {
    // Get all directories in the outputDir
    const directories = fs.readdirSync(outputDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory() && dirent.name.includes(modifiedFilename)) // Match the folder containing modifiedFilename
      .map(dirent => dirent.name);

    if (directories.length === 0) {
      return res.status(404).json({ message: 'Matching folder not found' });
    }

    // Use the first matching directory
    const matchedDir = directories[0];
    console.log(matchedDir, "matchedDir");

    // Path to 'code/sources'
    const sourcesDir = path.join(outputDir, matchedDir, 'code', 'sources');

    // Check if 'sources' directory exists
    if (!fs.existsSync(sourcesDir)) {
      return res.status(404).json({ message: "'sources' directory not found" });
    }

    // Find the first Java file in the 'sources' directory
    let javaFilePath = null;
    const findJavaFile = (dir) => {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isFile() && fullPath.endsWith('.java')) {
          javaFilePath = fullPath; // Found a .java file
          break;
        } else if (item.isDirectory()) {
          findJavaFile(fullPath); // Recursively search in subdirectories
          if (javaFilePath) break; // Stop if a file is found
        }
      }
    };

    findJavaFile(sourcesDir);

    if (!javaFilePath) {
      return res.status(404).json({ message: 'No Java file found in sources directory' });
    }

    console.log(javaFilePath, "javaFilePath");

    // Read the Java file
    fs.readFile(javaFilePath, 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading file:', err);
        return res.status(500).json({ message: 'Error reading file' });
      }
      res.send(data); // Send the Java code as plain text
    });
  } catch (err) {
    console.error('Error finding folder or file:', err);
    res.status(500).json({ message: 'Error finding folder or file' });
  }
});
app.post('/api/add-feature', (req, res) => {
  const { feature } = req.body; // Receive the feature from the frontend

  if (!feature) {
    return res.status(400).json({ message: 'No feature selected.' });
  }

  // Map the features to corresponding Java code snippets
  const featureCodeMap = {
    // Encryption and Decryption Feature Logic
    "Encryption and Decryption": `
  
    import javax.crypto.Cipher;
    import javax.crypto.KeyGenerator;
    import javax.crypto.SecretKey;
    import javax.crypto.spec.SecretKeySpec;
    import android.util.Base64;
    
    public class EncryptionUtil {
    
        private static final String ALGORITHM = "AES";
        private static final String SECRET_KEY = "1234567890123456"; // 16-byte key for AES-128 (**Replace with a strong, unique key!**)
    
        // Encryption method
        public static String encrypt(String input) throws Exception {
            SecretKeySpec secretKey = new SecretKeySpec(SECRET_KEY.getBytes(), ALGORITHM);
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey);
            byte[] encrypted = cipher.doFinal(input.getBytes());
            return Base64.encodeToString(encrypted, Base64.DEFAULT);
        }
    
        // Decryption method
        public static String decrypt(String encryptedInput) throws Exception {
            SecretKeySpec secretKey = new SecretKeySpec(SECRET_KEY.getBytes(), ALGORITHM);
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, secretKey);
            byte[] decodedValue = Base64.decode(encryptedInput, Base64.DEFAULT);
            byte[] decryptedValue = cipher.doFinal(decodedValue);
            return new String(decryptedValue);
        }
    }
    
    // (Place this code in your MainActivity class or wherever you need to use encryption/decryption)
    
    public class MainActivity extends AppCompatActivity implements View.OnClickListener {
        // ... existing code ...
    
        @Override
        public void onClick(View view) {
            num1 = getIntFromEditText(editTextN1);
            num2 = getIntFromEditText(editTextN2);
    
            // ... existing code ...
    
            if (view.getId() == R.id.btn_add) {
                String encryptedResult = "";
                try {
                    encryptedResult = EncryptionUtil.encrypt(String.valueOf(num1 + num2));
                } catch (Exception e) {
                    e.printStackTrace();
                }
                String decryptedResult = "";
                try {
                    decryptedResult = EncryptionUtil.decrypt(encryptedResult);
                } catch (Exception e) {
                    e.printStackTrace();
                }
                textView.setText(getString(R.string.answer_text, decryptedResult));
            } else if (view.getId() == R.id.btn_sub) {
                // ... (similar logic for other operations with encryption/decryption)
            } else if (view.getId() == R.id.btn_mul) {
                // ...
            } else if (view.getId() == R.id.btn_div) {
                // ...
            }
        }
    }
  `,
  
  
    "ProGuard configuration": `// 
  -keep class com.example.myapp.** { *; }
  -dontwarn com.example.myapp.**
  -keep public class com.example.myapp.MainActivity { public static void main(java.lang.String[]); }
  `,
  
    // APK Signing Configuration Logic
    "APK signing configuration": `
  android {
      signingConfigs {
          release {
              storeFile file("path/to/keystore.jks")
              storePassword "your-store-password"
              keyAlias "your-key-alias"
              keyPassword "your-key-password"
          }
      }
      buildTypes {
          release {
              signingConfig signingConfigs.release
          }
      }
  }
  `,
  
    // App Permissions Logic
    "App permissions": `// 
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
  <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
  <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
  `
  };
  

  // Find the Java file where the feature code should be added
  const javaFilePath = path.join('E:/uploads/decompiled_output/', 'jadx-gui-1.5.1_1733899818687-990521215-app-debug-044192c7d8e02801bedc6b200e860080', 'code', 'sources', '46', '00000e46.java');
 // Adjust the path and file name

  const featureCode = featureCodeMap[feature];

  if (!featureCode) {
    return res.status(400).json({ message: 'Feature code not found for the selected feature.' });
  }

  // Append the feature code to the Java file
  fs.appendFile(javaFilePath, featureCode, (err) => {
    if (err) {
      console.error('Error appending feature code:', err);
      return res.status(500).json({ message: 'Error adding feature to the Java code.' });
    }

    res.json({ message: 'Feature added successfully to the Java code.' });
    
  });
});
app.post('/api/rebuild-apk', (req, res) => {
  const { javaFilePath } = req.body;

  if (!javaFilePath) {
    return res.status(400).json({ message: 'Java file path is required.' });
  }

  // Log the received file path
  console.log('Received Java file path:', javaFilePath);

  // Ensure the file exists (or perform other validation as needed)
  if (!path.isAbsolute(javaFilePath)) {
    return res.status(400).json({ message: 'Invalid file path.' });
  }

  // Define the command to rebuild the APK (adjust this as per your APK rebuild process)
  const rebuildCommand = `java -jar someToolToRebuildAPK.jar ${javaFilePath}`;

  // Execute the command to rebuild the APK
  exec(rebuildCommand, (err, stdout, stderr) => {
    if (err) {
      console.error('Error rebuilding APK:', stderr);
      return res.status(500).json({ message: 'Error rebuilding APK.' });
    }

    // Log the stdout to see the process output
    console.log('Rebuild output:', stdout);

    // Return success response
    res.status(200).json({ message: 'APK rebuild started successfully!' });
  });
});



// Error-handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server error. Please try again later.' });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
