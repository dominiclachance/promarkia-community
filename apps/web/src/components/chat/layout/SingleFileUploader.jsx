import { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import IconButton from '@mui/material/IconButton';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import Tooltip from '@mui/material/Tooltip';
import { ref, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import CircularProgress from '@mui/material/CircularProgress';
import Swal from 'sweetalert2';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { auth, storage } from '../../../firebase/client';

export { storage };

const DEFAULT_MAX_FILE_SIZE_IN_BYTES = 50000000;
const allowedFileTypes = new Set(['text/csv', 'text/plain', 'application/pdf', 'image/png', 'image/jpeg', 'video/mp4']);
const validateFile = (file, maxFileSizeInBytes) => {
  if (!allowedFileTypes.has(file.type)) {
    Swal.fire({ icon: 'error', title: 'Invalid File Type', text: `${file.name}: File type not allowed` });
    return false;
  }
  if (file.size > maxFileSizeInBytes) {
    Swal.fire({ icon: 'error', title: 'File Too Large', text: `${file.name}: File is too large` });
    return false;
  }
  return true;
};

const FileUpload = ({ maxFileSizeInBytes = DEFAULT_MAX_FILE_SIZE_IN_BYTES, onFileUpload, ...otherProps }) => {
  const fileInputField = useRef(null);
  const [progresspercent, setProgresspercent] = useState(0);
  const theme = useTheme();
  const { t } = useTranslation();

  const handleUploadBtnClick = () => fileInputField.current.click();

  const uploadSingleFile = (file, userId) => new Promise((resolve, reject) => {
    const storageRef = ref(storage, `files/${userId}/${file.name}`);
    const metadata = { contentType: file.type };
    const uploadTask = uploadBytesResumable(storageRef, file, metadata);
    uploadTask.on('state_changed',
      (snapshot) => setProgresspercent(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
      (error) => reject({ fileName: file.name, error }),
      () => getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => resolve({ fileName: file.name, downloadURL }))
    );
  });

  const handleNewFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    Swal.fire({ title: 'File uploader...', text: 'We are uploading your files...', backdrop: false, color: 'white', background: '#171717', allowOutsideClick: false, customClass: { container: 'swal2-container-shift' }, didOpen: () => Swal.showLoading() });
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Swal.close();
      Swal.fire({ icon: 'error', title: 'Authentication Error', text: 'User is not authenticated' });
      return;
    }
    const userId = currentUser.uid;
    try {
      const results = await Promise.all(files.map(async (file) => {
        if (!validateFile(file, maxFileSizeInBytes)) return null;
        try {
          return await uploadSingleFile(file, userId);
        } catch (uploadError) {
          Swal.fire({ icon: 'error', title: 'Upload Failed', text: `${file.name}: Upload failed - ${uploadError.error.message}` });
          return null;
        }
      }));
      Swal.close();
      const successfulUploads = results.filter(Boolean);
      if (successfulUploads.length && onFileUpload) {
        sessionStorage.setItem('filecontent', JSON.stringify(successfulUploads));
        onFileUpload(successfulUploads);
      }
    } catch (error) {
      Swal.close();
      Swal.fire({ icon: 'error', title: 'Upload error', text: error.message });
    }
  };

  return <>
    <Tooltip disableFocusListener placement='left' title={t('upload_file')}>
      <IconButton onClick={handleUploadBtnClick} disabled={false} color='primary' sx={{ ':hover': { color: theme.palette.primary.dark }, p: '10px', marginLeft: '10px', marginBottom: '5px', color: theme.palette.primary.main }} aria-label={t('upload_file')}>
        {!progresspercent || progresspercent === 100 ? <AttachFileIcon title='Upload file' id='send_ok' /> : <CircularProgress title='Waiting for upload...' size='1rem' />}
      </IconButton>
    </Tooltip>
    <input type='file' ref={fileInputField} onChange={handleNewFileUpload} style={{ display: 'none' }} accept='.csv,.pdf,.txt,.mp4,.png,.jpg' multiple {...otherProps} />
  </>;
};

export default FileUpload;

FileUpload.propTypes = {
  label: PropTypes.string,
  maxFileSizeInBytes: PropTypes.number,
  onFileUpload: PropTypes.func,
};
