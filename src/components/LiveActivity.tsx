import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface LiveActivityProps {
  data: number[];
}

export function LiveActivity({ data }: LiveActivityProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 100;
    const height = 30;
    
    const x = d3.scaleLinear()
      .domain([0, data.length - 1])
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data) || 1])
      .range([height, 0]);

    const line = d3.line<number>()
      .x((_, i) => x(i))
      .y(d => y(d))
      .curve(d3.curveBasis);

    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2)
      .attr('d', line);

    // Add a pulse dot at the end
    svg.append('circle')
      .attr('cx', x(data.length - 1))
      .attr('cy', y(data[data.length - 1]))
      .attr('r', 3)
      .attr('fill', '#3b82f6')
      .append('animate')
      .attr('attributeName', 'r')
      .attr('values', '3;5;3')
      .attr('dur', '1s')
      .attr('repeatCount', 'indefinite');

  }, [data]);

  return (
    <div className="flex items-center gap-2">
      <svg ref={svgRef} width="100" height="30" className="overflow-visible" />
      <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider animate-pulse">Live</span>
    </div>
  );
}
