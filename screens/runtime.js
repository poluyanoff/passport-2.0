import React from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import * as T from 'taiga-ui-proprietary';
import 'taiga-ui-proprietary/styles.css';

// Preserve the documented console API for checking a prototype.
window.TaigaUI = T;
const ReactDOM = { createRoot, createPortal };
export { React, ReactDOM, T, createRoot };
