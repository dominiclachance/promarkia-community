import { useState } from 'react';
import ArrowCircleDownIcon from '@mui/icons-material/ArrowCircleDown';
import Tooltip from '@mui/material/Tooltip';
import { t } from 'i18next'; // NEW IMPORT

const ScrollButton = () => {

	const [visible, setVisible] = useState(true)

	const toggleVisible = () => {
		const scrolled = document.documentElement.scrollTop;
		if (scrolled > 500000) {
			setVisible(false)
		}
		else if (scrolled <= 500000) {
			setVisible(true)
		}
	};

	const scrollToBottom = () => {
		window.scrollTo({
			top: document.documentElement.scrollHeight+250,
			behavior: 'smooth'
			/* you can also use 'auto' behaviour 
			in place of 'smooth' */
		});
	};

	window.addEventListener('scroll', toggleVisible);

	return (
		<Tooltip placement="right-start" title={t('scroll_to_bottom')}>
		<ArrowCircleDownIcon onClick={scrollToBottom} style={{ display: visible ? 'inline' : 'none', marginBottom:"15px", marginTop: "5px" }} />
		</Tooltip>
	);
}

export default ScrollButton;